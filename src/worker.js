require('dotenv').config();
const pool=require('./config/db');
const queue=require('./lib/queue');
let running=true;
process.on('SIGTERM',()=>{running=false;});
process.on('SIGINT',()=>{running=false;});
async function processJob(job) {
  const cx=await pool.getConnection();
  try {
    await cx.beginTransaction();
    const [rows]=await cx.query('SELECT state FROM media_jobs WHERE job_id=? AND user_id=? FOR UPDATE',[job.jobId,job.userId]);
    if (!rows.length || rows[0].state==='done') {await cx.commit();return;}
    const x=job.media;
    const [insert]=await cx.query('INSERT INTO media_tracker (user_id,title,media_type,watch_status,season_vibe,rating,poster_url) VALUES (?,?,?,?,?,?,?)',
      [job.userId,x.title,x.media_type,x.watch_status||'Plan to Watch',x.season_vibe||'None',x.rating||null,x.custom_poster||x.custom_url||null]);
    await cx.query('UPDATE media_jobs SET state=?,media_id=?,completed_at=NOW(),error_text=NULL WHERE job_id=?', ['done',insert.insertId,job.jobId]);
    await cx.commit();
  } catch(err){await cx.rollback();throw err;}finally{cx.release();}
  try {await require('./lib/cache').invalidate(job.userId);}catch(err){console.warn('Cache invalidation failed:',err.message);}
}
(async()=>{
  console.log('worker started, backend:',process.env.QUEUE_BACKEND||'redis');
  await queue.recoverLocal();
  while(running){
    let message;
    try {
      message=await queue.receive();
      if (!message) continue;
      await processJob(message.payload);
      await message.ack();
    }catch(err){console.error('Worker error:',err.message);await new Promise(r=>setTimeout(r,2000));}
  }
  await pool.end();
})().catch(err=>{console.error(err);process.exitCode=1;});
