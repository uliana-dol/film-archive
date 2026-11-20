const test=require('node:test');
const assert=require('node:assert/strict');
test('SQS JSON client signs request using AWS SigV4 (offline fake fetch)',async()=>{
  const originalFetch=global.fetch;
  const env={...process.env};
  try {
    process.env.QUEUE_BACKEND='sqs';
    process.env.AWS_ACCESS_KEY_ID='AKIDEXAMPLE';
    process.env.AWS_SECRET_ACCESS_KEY='secret_key_for_test';
    process.env.AWS_REGION='eu-north-1';
    process.env.SQS_QUEUE_URL='https://sqs.eu-north-1.amazonaws.com/111111111111/example';
    let captured;
    global.fetch=async(url,init)=>{
      captured={url,init};
      return {ok:true,json:async()=>({MessageId:'dummy'})};
    };
    const queue=require('../src/lib/queue');
    const r=await queue.send({jobId:'test-123',userId:1});
    assert.equal(r.MessageId,'dummy');
    assert.equal(captured.url,'https://sqs.eu-north-1.amazonaws.com/');
    assert.equal(captured.init.headers['x-amz-target'],'AmazonSQS.SendMessage');
    assert.match(captured.init.headers.authorization,/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\//);
    assert.equal(JSON.parse(captured.init.body).QueueUrl,process.env.SQS_QUEUE_URL);
  } finally {
    global.fetch=originalFetch;
    Object.keys(process.env).filter(x=>!(x in env)).forEach(x=>delete process.env[x]);
    Object.assign(process.env,env);
  }
});
