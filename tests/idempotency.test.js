const test=require('node:test');
const assert=require('node:assert/strict');
const fakeStore=new Map();
const fakeRedis=async (...args)=>{
  const [cmd,key,val,...rest]=args;
  if(cmd==='GET')return fakeStore.get(key)||null;
  if(cmd==='SET'){
    if(rest.includes('NX') && fakeStore.has(key))return null;
    fakeStore.set(key,val);
    return 'OK';
  }
  if(cmd==='DEL')return fakeStore.delete(key)?1:0;
  throw new Error('fake Redis does not implement '+cmd);
};
const id=require.resolve('../src/lib/redis');
require.cache[id]={id,filename:id,loaded:true,exports:{redis:fakeRedis}};
const {perform}=require('../src/lib/idempotency');
const req=(key,title)=>({get:()=>key,user:{userId:17},method:'POST',path:'/',body:{title,media_type:'LoadTest'}});
test('identical Idempotency-Key returns identical response with one execution',async()=>{
  let executions=0;
  const fn=async()=>{executions++;return {status:201,body:{id:42,message:'Added!'}};};
  const a=await perform(req('test-idempotency-key','A'),fn);
  const b=await perform(req('test-idempotency-key','A'),fn);
  assert.deepEqual(a,b);
  assert.equal(executions,1);
});
test('reused Idempotency-Key with different payload is rejected',async()=>{
  const response=await perform(req('test-idempotency-key','B'),async()=>{throw new Error('Must not reach handler');});
  assert.equal(response.status,422);
});
test('two overlapping writes are serialized by a Redis NX lock',async()=>{
  let release;
  const slow=new Promise(resolve=>{release=resolve;});
  const first=perform(req('another-dedup-key','C'),async()=>{await slow;return {status:201,body:{id:100}};});
  await new Promise(r=>setImmediate(r));
  const second=await perform(req('another-dedup-key','C'),async()=>{throw new Error('duplicate executed');});
  assert.equal(second.status,409);
  release();
  const done=await first;
  assert.equal(done.status,201);
});
