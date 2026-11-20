const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const path=require('node:path');
test('MySQL schema contains job status table',()=>{
  const sql=readFileSync(path.join(__dirname,'../init.sql'),'utf8');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS media_jobs/);
});
test('cache-aside uses TTL between 30 and 60 by default',()=>{
  const s=readFileSync(path.join(__dirname,'../src/lib/cache.js'),'utf8');
  assert.match(s,/\|\| 45/);
});
test('HTTP routes include async, status, and by ID',()=>{
  const routes=readFileSync(path.join(__dirname,'../src/routes/mediaRoutes.js'),'utf8');
  assert.match(routes,/post\('\/async'/);
  assert.match(routes,/get\('\/jobs\/:jobId'/);
  assert.match(routes,/get\('\/:id'/);
});
