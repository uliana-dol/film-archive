const { createHash } = require('node:crypto');
const { redis } = require('./redis');
const hours24 = 86400;
function fingerprint(payload) { return createHash('sha256').update(JSON.stringify(payload)).digest('hex'); }
async function perform(req, handler) {
  const header = req.get('Idempotency-Key');
  if (!header) return handler();
  if (!/^[a-zA-Z0-9_.:-]{8,128}$/.test(header)) return {status:400, body:{error:'Idempotency-Key must be 8-128 allowed chars'}};
  const base = `filmarchive:idempotency:${req.user.userId}:${header}`;
  const hash = fingerprint({method:req.method,path:req.path,body:req.body});
  const cached = await redis('GET', `${base}:result`);
  if (cached) {
    const saved = JSON.parse(cached);
    if (saved.hash !== hash) return {status:422,body:{error:'Idempotency-Key reused with different payload'}};
    return saved.result;
  }
  const acquired = await redis('SET', `${base}:lock`, hash, 'NX', 'EX', '60');
  if (acquired !== 'OK') return {status:409,body:{error:'Request in progress; retry shortly'}};
  try {
    const result = await handler();
    if (result.status < 500) await redis('SET',`${base}:result`,JSON.stringify({hash,result}),'EX',hours24);
    return result;
  } finally { await redis('DEL', `${base}:lock`); }
}
module.exports = {perform};
