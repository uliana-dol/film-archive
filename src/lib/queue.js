const { createHash, createHmac } = require('node:crypto');
const { redis } = require('./redis');
const local = () => (process.env.QUEUE_BACKEND || 'redis') === 'redis';
const sha = x => createHash('sha256').update(x).digest('hex');
const hmac = (k,s) => createHmac('sha256',k).update(s).digest();
let credentials;
async function getCredentials() {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) return {
    AccessKeyId:process.env.AWS_ACCESS_KEY_ID,SecretAccessKey:process.env.AWS_SECRET_ACCESS_KEY,Token:process.env.AWS_SESSION_TOKEN
  };
  if (credentials && new Date(credentials.Expiration).getTime() - Date.now() > 120000) return credentials;
  const base='http://169.254.169.254/latest';
  const tokenRes = await fetch(`${base}/api/token`,{method:'PUT',headers:{'X-aws-ec2-metadata-token-ttl-seconds':'600'},signal:AbortSignal.timeout(3000)});
  if (!tokenRes.ok) throw new Error('EC2 IMDSv2 token unavailable');
  const hdr={'X-aws-ec2-metadata-token':await tokenRes.text()};
  const role = await (await fetch(`${base}/meta-data/iam/security-credentials/`,{headers:hdr,signal:AbortSignal.timeout(3000)})).text();
  const response=await fetch(`${base}/meta-data/iam/security-credentials/${role.trim()}`,{headers:hdr,signal:AbortSignal.timeout(3000)});
  if (!response.ok) throw new Error('Cannot retrieve AWS role credentials');
  credentials=await response.json();
  return credentials;
}
async function sqs(operation,payload) {
  const region=process.env.AWS_REGION||'eu-north-1';
  const host=`sqs.${region}.amazonaws.com`;
  const c=await getCredentials();
  const body=JSON.stringify(payload);
  const now=new Date().toISOString().replace(/[:-]|\.\d{3}/g,'');
  const day=now.substring(0,8);
  const headers={'content-type':'application/x-amz-json-1.0','host':host,'x-amz-date':now,'x-amz-target':`AmazonSQS.${operation}`};
  if (c.Token) headers['x-amz-security-token']=c.Token;
  const names=Object.keys(headers).sort();
  const canonical = `POST\n/\n\n${names.map(k=>`${k}:${headers[k].trim()}\n`).join('')}\n${names.join(';')}\n${sha(body)}`;
  const scope=`${day}/${region}/sqs/aws4_request`;
  const toSign=`AWS4-HMAC-SHA256\n${now}\n${scope}\n${sha(canonical)}`;
  const sig=hmac(hmac(hmac(hmac(`AWS4${c.SecretAccessKey}`,day),region),'sqs'),'aws4_request');
  headers.authorization=`AWS4-HMAC-SHA256 Credential=${c.AccessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${hmac(sig,toSign).toString('hex')}`;
  const r=await fetch(`https://${host}/`,{method:'POST',headers,body,signal:AbortSignal.timeout(operation==='ReceiveMessage'?25000:6000)});
  // SQS long-polling may return an empty body when there are no messages.
  const raw = await r.text();
  let response = {};
  if (raw.trim()) {
    try { response = JSON.parse(raw); }
    catch (err) { throw new Error(`SQS ${operation} invalid JSON (HTTP ${r.status}): ${raw.slice(0,300)}`); }
  }
  if (!r.ok) throw new Error(`SQS ${operation} HTTP ${r.status}: ${JSON.stringify(response).slice(0,300)}`);
  if (!raw.trim() && !['ReceiveMessage','DeleteMessage'].includes(operation)) throw new Error(`SQS ${operation} returned an empty response`);
  return response;
}
async function send(job) {
  if (local()) return redis('LPUSH','filmarchive:jobs',JSON.stringify(job));
  return sqs('SendMessage',{QueueUrl:process.env.SQS_QUEUE_URL,MessageBody:JSON.stringify(job)});
}
async function receive() {
  if (local()) {
    const raw=await redis('BRPOPLPUSH','filmarchive:jobs','filmarchive:processing','10');
    return raw ? {payload:JSON.parse(raw),ack:()=>redis('LREM','filmarchive:processing','1',raw)} : null;
  }
  const r=await sqs('ReceiveMessage',{QueueUrl:process.env.SQS_QUEUE_URL,MaxNumberOfMessages:1,WaitTimeSeconds:10,VisibilityTimeout:90});
  if (!r.Messages?.length) return null;
  const msg=r.Messages[0];
  return {payload:JSON.parse(msg.Body),ack:()=>sqs('DeleteMessage',{QueueUrl:process.env.SQS_QUEUE_URL,ReceiptHandle:msg.ReceiptHandle})};
}
async function recoverLocal() {
  if (!local()) return;
  while (await redis('RPOPLPUSH','filmarchive:processing','filmarchive:jobs')) {}
}
module.exports={send,receive,recoverLocal};
