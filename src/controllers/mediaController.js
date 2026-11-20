const pool = require('../config/db');
const cache = require('../lib/cache');
const {createMedia,validateMedia} = require('../lib/media');
const {perform} = require('../lib/idempotency');
const queue = require('../lib/queue');
const {randomUUID,createHash} = require('node:crypto');

const handleError=(res,err)=>{console.error(err);return res.status(err.status||500).json({error:err.status?err.message:'Internal server error'});};
exports.getAllMedia = async (req,res) => {
  try {
    const hit=await cache.read(req.user.userId);
    if (hit !== null) return res.json(hit);
    const [rows]=await pool.query('SELECT * FROM media_tracker WHERE user_id = ? ORDER BY created_at DESC, id DESC',[req.user.userId]);
    await cache.store(req.user.userId,rows);
    return res.json(rows);
  } catch(err) {return handleError(res,err);}
};
exports.getOneMedia = async (req,res) => {
  try { const [rows]=await pool.query('SELECT * FROM media_tracker WHERE id=? AND user_id=?',[req.params.id,req.user.userId]);
    return rows.length?res.json(rows[0]):res.status(404).json({error:'Not found'});
  } catch(err){return handleError(res,err);}
};
exports.getMe=async(req,res)=>res.json({id:req.user.userId,username:req.user.username});
exports.cacheStats=async(req,res)=>{try{return res.json(await cache.stats());}catch(err){return handleError(res,err);}};
exports.addMedia=async(req,res)=>{
  try {const r=await perform(req,async()=>({status:201,body:await createMedia(req.user.userId,req.body,req.get('Idempotency-Key'))}));return res.status(r.status).json(r.body);}
  catch(err){return handleError(res,err);}
};
exports.addMediaAsync=async(req,res)=>{
  try {
    validateMedia(req.body);
    const result=await perform(req,async()=>{
      const key=req.get('Idempotency-Key');
      const digest= key ? createHash('sha256').update(`${req.user.userId}:${key}`).digest('hex') : null;
      const jobId=digest ? `${digest.slice(0,8)}-${digest.slice(8,12)}-${digest.slice(12,16)}-${digest.slice(16,20)}-${digest.slice(20,32)}` : randomUUID();
      await pool.query('INSERT IGNORE INTO media_jobs (job_id,user_id,state) VALUES (?, ?, ?)',[jobId,req.user.userId,'pending']);
      try {await queue.send({jobId,userId:req.user.userId,media:req.body});}
      catch(err){await pool.query('UPDATE media_jobs SET state=? WHERE job_id=?',['failed',jobId]);throw err;}
      return {status:202,body:{job_id:jobId,status:'pending',status_url:`/api/media/jobs/${jobId}`}};
    });
    return res.status(result.status).json(result.body);
  } catch(err){return handleError(res,err);}
};
exports.jobStatus=async(req,res)=>{
  try {const [rows]=await pool.query('SELECT job_id,state,media_id,error_text,created_at,completed_at FROM media_jobs WHERE job_id=? AND user_id=?',[req.params.jobId,req.user.userId]);
    if (!rows.length) return res.status(404).json({error:'Job not found'});
    return res.json(rows[0]);
  } catch(err){return handleError(res,err);}
};
exports.updateMedia=async(req,res)=>{
  const b=req.body;
  try {const [r]=await pool.query('UPDATE media_tracker SET title=?,watch_status=?,rating=?,genre=?,release_year=?,country=?,duration=?,plot=?,actors=?,season_vibe=? WHERE id=? AND user_id=?',
    [b.title,b.watch_status,b.rating??null,b.genre??null,b.release_year??null,b.country??null,b.duration??null,b.plot??null,b.actors??null,b.season_vibe??'None',req.params.id,req.user.userId]);
    if(!r.affectedRows) return res.status(404).json({error:'Not found'});
    await cache.invalidate(req.user.userId);return res.json({message:'Updated!'});
  } catch(err){return handleError(res,err);}
};
exports.deleteMedia=async(req,res)=>{
  try {const [r]=await pool.query('DELETE FROM media_tracker WHERE id=? AND user_id=?',[req.params.id,req.user.userId]);
    if(!r.affectedRows) return res.status(404).json({error:'Not found'});
    await cache.invalidate(req.user.userId);return res.json({message:'Deleted!'});
  } catch(err){return handleError(res,err);}
};
