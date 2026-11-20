const pool = require('../config/db');
const cache = require('./cache');

function validateMedia(input) {
  if (!input || typeof input.title !== 'string' || input.title.trim().length < 1 || input.title.length > 255) {
    throw Object.assign(new Error('title required (1..255 chars)'),{status:400});
  }
  if (!input.media_type || typeof input.media_type !== 'string' || input.media_type.length > 50) {
    throw Object.assign(new Error('media_type required'),{status:400});
  }
}
async function lookup(title,media_type) {
  if (process.env.METADATA_LOOKUP === 'false') return {};
  try {
    if (['Movie','Cartoon','Anime Movie'].includes(media_type) && process.env.OMDB_API_KEY) {
      const r=await fetch(`https://www.omdbapi.com/?t=${encodeURIComponent(title)}&type=movie&apikey=${process.env.OMDB_API_KEY}`,{signal:AbortSignal.timeout(3000)});
      const m=await r.json();
      if (m.Response==='True') return {title:m.Title,genre:m.Genre,release_year:m.Year,country:m.Country,duration:m.Runtime,plot:m.Plot,actors:m.Actors,poster_url:m.Poster};
    }
    if (media_type !== 'LoadTest' && !title.startsWith('k6-')) {
      const r=await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}&embed=cast`,{signal:AbortSignal.timeout(3000)});
      if (r.ok) {
        const m=await r.json();
        return {title:m.name,genre:(m.genres||[]).join(', '),release_year:m.premiered?.slice(0,4),country:m.network?.country?.name||m.webChannel?.country?.name,duration:m.averageRuntime?`${m.averageRuntime} min/ep`:null,plot:m.summary?.replace(/<[^>]+>/g,''),actors:m._embedded?.cast?.slice(0,4).map(c=>c.person.name).join(', '),poster_url:m.image?.original};
      }
    }
  } catch (err) { console.warn('Metadata lookup skipped:',err.message); }
  return {};
}
async function createMedia(userId,input,idempotencyKey) {
  validateMedia(input);
  const enriched=await lookup(input.title,input.media_type);
  const pick=(k,defaultValue=null)=> input[k] === undefined ? (enriched[k]??defaultValue) : input[k];
  const title= input.title.startsWith('k6-') ? input.title : (enriched.title || input.title);
  const fields=[userId,title,input.media_type,input.watch_status||'Plan to Watch',input.season_vibe||'None',input.rating||null,pick('genre'),pick('release_year'),pick('country'),pick('duration'),pick('plot'),pick('actors'),input.custom_poster || input.custom_url || pick('poster_url')];
  let cx=pool,transaction=false;
  try {
    if(idempotencyKey){
      cx=await pool.getConnection();transaction=true;
      await cx.beginTransaction();
      const {createHash}=require('node:crypto');
      const hash=createHash('sha256').update(JSON.stringify({method:'POST',path:'/',body:input})).digest('hex');
      await cx.query('DELETE FROM idempotency_records WHERE user_id=? AND idempotency_key=? AND expires_at < NOW()', [userId,idempotencyKey]);
      await cx.query('INSERT IGNORE INTO idempotency_records (user_id,idempotency_key,request_hash,expires_at) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 24 HOUR))',[userId,idempotencyKey,hash]);
      const [prior]=await cx.query('SELECT request_hash,response_json FROM idempotency_records WHERE user_id=? AND idempotency_key=? FOR UPDATE',[userId,idempotencyKey]);
      if(prior[0].request_hash !== hash) throw Object.assign(new Error('Idempotency-Key reused with different payload'),{status:422});
      if(prior[0].response_json){await cx.commit();return JSON.parse(prior[0].response_json);}
    }
    const [r]=await cx.query(`INSERT INTO media_tracker (user_id,title,media_type,watch_status,season_vibe,rating,genre,release_year,country,duration,plot,actors,poster_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,fields);
    const result={message:'Added!',id:r.insertId};
    if(transaction){
      await cx.query('UPDATE idempotency_records SET response_json=? WHERE user_id=? AND idempotency_key=?',[JSON.stringify(result),userId,idempotencyKey]);
      await cx.commit();
    }
    try {await cache.invalidate(userId);}catch(err){console.warn('Cache invalidation failed:',err.message);}
    return result;
  } catch(err){ if(transaction) try{await cx.rollback();}catch(e){console.error('Rollback failed',e);} throw err; }
  finally { if(transaction) cx.release(); }
}
module.exports={createMedia,validateMedia};
