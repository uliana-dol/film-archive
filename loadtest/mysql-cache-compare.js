import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
const readCount = new Counter('list_gets');
export const options = {
  scenarios: {
    list_reads: {
      executor: 'constant-arrival-rate',
      rate: 30,
      timeUnit: '1s',
      duration: '90s',
      preAllocatedVUs: 10,
      maxVUs: 25,
    },
  },
  thresholds: { http_req_failed: ['rate<0.01'] },
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
};
export function setup() {
  const username = 'sqlcmp_' + __ENV.RUN_ID;
  const pwd = 'LocalTestOnly_1234!';
  const json = { headers: { 'Content-Type': 'application/json' } };
  const reg = http.post(BASE + '/api/auth/register', JSON.stringify({username, password: pwd}), json);
  if (reg.status !== 201) throw new Error('register failed: HTTP ' + reg.status);
  const login = http.post(BASE + '/api/auth/login', JSON.stringify({username, password: pwd}), json);
  if (login.status !== 200) throw new Error('login failed: HTTP ' + login.status);
  const auth = { Authorization: 'Bearer ' + login.json('token') };
  const create = http.post(BASE + '/api/media', JSON.stringify({title:'MySQL comparison', media_type:'LoadTest'}), {
    headers: {...auth, 'Content-Type':'application/json'},
  });
  if (create.status !== 201) throw new Error('create failed: HTTP ' + create.status);
  const warm = http.get(BASE + '/api/media', {headers:auth});
  if (warm.status !== 200) throw new Error('warm-up failed: HTTP ' + warm.status);
  return { auth };
}
export default function(data) {
  const r = http.get(BASE + '/api/media', {headers:data.auth, tags:{name:'list_read'}});
  check(r, {'list GET 200': x => x.status === 200});
  if (r.status === 200) readCount.add(1);
}