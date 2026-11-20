import http from 'k6/http';
import {check,sleep} from 'k6';
const BASE=(__ENV.BASE_URL||'http://127.0.0.1:3000').replace(/\/$/,'');
const RUN=__ENV.RUN_ID||'queue';
export const options={vus:5,duration:'2m',summaryTrendStats:['avg','med','p(95)','p(99)']};
let token;
export default function(){
  const h={'Content-Type':'application/json'};
  if(!token){
    const u=`k6q_${RUN}_${__VU}`.replace(/[^\w]/g,'_').slice(0,45);
    http.post(`${BASE}/api/auth/register`,JSON.stringify({username:u,password:'Lab2_queue_1234'}),{headers:h});
    const r=http.post(`${BASE}/api/auth/login`,JSON.stringify({username:u,password:'Lab2_queue_1234'}),{headers:h});
    if(r.status!==200){sleep(1);return;}
    token=r.json('token');
  }
  const r=http.post(`${BASE}/api/media/async`,JSON.stringify({title:`k6-${RUN}-${__VU}-${__ITER}-${Date.now()}`,media_type:'LoadTest'}),{
    headers:{...h,Authorization:`Bearer ${token}`,'Idempotency-Key':`q_${RUN}_${__VU}_${__ITER}_${Date.now()}`},tags:{name:'async_create'}});
  check(r,{'async accepted':x=>x.status===202});
  if(r.status===202){
    const jobId=r.json('job_id');
    const s=http.get(`${BASE}/api/media/jobs/${jobId}`,{headers:{Authorization:`Bearer ${token}`},tags:{name:'job_status'}});
    check(s,{'job lookup works':x=>x.status===200});
  }
  sleep(1);
}
