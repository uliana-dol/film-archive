const { redis } = require('./redis');
const enabled = () => (process.env.CACHE_ENABLED || 'true').toLowerCase() === 'true';
const ttl = Number(process.env.CACHE_TTL_SECONDS || 45);
const key = userId => `filmarchive:media:${userId}`;
async function read(userId) {
  if (!enabled()) return null;
  const data = await redis('GET', key(userId));
  await redis('INCR', data === null ? 'filmarchive:cache:misses' : 'filmarchive:cache:hits');
  return data === null ? null : JSON.parse(data);
}
async function store(userId, value) {
  if (enabled()) await redis('SET', key(userId), JSON.stringify(value), 'EX', ttl);
}
async function invalidate(userId) { await redis('DEL', key(userId)); }
async function stats() {
  const [hits, misses] = await Promise.all([redis('GET','filmarchive:cache:hits'), redis('GET','filmarchive:cache:misses')]);
  const h = Number(hits||0), m = Number(misses||0);
  return {enabled: enabled(), hits:h, misses:m, hit_ratio: h+m ? h/(h+m) : 0, ttl_seconds:ttl};
}
module.exports = {read,store,invalidate,stats};
