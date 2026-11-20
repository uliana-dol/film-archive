import http from 'k6/http';
import {check, sleep} from 'k6';
import {Trend, Rate, Counter} from 'k6/metrics';

const BASE=(__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/,'');
const USERS=Number(__ENV.VUS || 40);
const RUN=__ENV.RUN_ID || 'lab2';
const PAUSE=Number(__ENV.PAUSE || 0.15);
const cacheHits=new Rate('read_success');
const writes=new Counter('media_writes');
const authErrors=new Counter('auth_errors');
export const options={
  stages:[
    {duration:'3m',target:USERS},
    {duration:'5m',target:USERS},
    {duration:'2m',target:0},
  ],
  thresholds:{'http_req_failed':['rate<0.10']},
  summaryTrendStats:['avg','min','med','p(90)','p(95)','p(99)','max'],
  discardResponseBodies:false,
};
const h={'Content-Type':'application/json'};
let token;
function ensureToken(){
  if(token) return token;
  const username=`k6_${RUN}_${__VU}`.replace(/[^\w]/g,'_').slice(0,45);
  const password='Lab2_test_only_1234';
  const register=http.post(`${BASE}/api/auth/register`,JSON.stringify({username,password}),{headers:h,tags:{name:'register'}});
  if(![201,500].includes(register.status)) authErrors.add(1);
  const login=http.post(`${BASE}/api/auth/login`,JSON.stringify({username,password}),{headers:h,tags:{name:'login'}});
  check(login,{'login 200': r=>r.status===200});
  if(login.status!==200){authErrors.add(1);return null;}
  token=login.json('token');
  return token;
}
function read(url,tags){
  const r=http.get(url,{headers:{Authorization:`Bearer ${token}`},tags});
  cacheHits.add(r.status===200);
  check(r,{'read OK':x=>x.status===200});
  return r;
}
export default function(){
  if(!ensureToken()){sleep(1);return;}
  const uid=`${RUN}_${__VU}_${__ITER}_${Date.now()}`;
  const body={title:`k6-${uid}`,media_type:'LoadTest',watch_status:'Plan to Watch',season_vibe:'None'};
  const r=http.post(`${BASE}/api/media`,JSON.stringify(body),{headers:{...h,Authorization:`Bearer ${token}`},tags:{name:'create'}});
  check(r,{'created 201':x=>x.status===201});
  if(r.status!==201){sleep(1);return;}
  writes.add(1);
  const id=r.json('id');
  for(let i=0;i<3;i++){
    read(`${BASE}/api/media`,{name:'list'});
    read(`${BASE}/api/media/${id}`,{name:'item'});
    read(`${BASE}/api/media/me`,{name:'profile'});
  }
  sleep(PAUSE);
}
