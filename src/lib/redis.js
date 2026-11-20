const net = require('node:net');
const { URL } = require('node:url');
const target = new URL(process.env.REDIS_URL || 'redis://redis:6379');

function parse(buf, pos = 0) {
  const i = buf.indexOf('\r\n', pos);
  if (i < 0) return null;
  const type = String.fromCharCode(buf[pos]);
  const value = buf.toString('utf8', pos + 1, i);
  const next = i + 2;
  if (type === '+' || type === ':' || type === '-') {
    if (type === '-') throw new Error(`Redis: ${value}`);
    return { value: type === ':' ? Number(value) : value, next };
  }
  if (type === '$') {
    const n = Number(value);
    if (n === -1) return { value: null, next };
    if (buf.length < next + n + 2) return null;
    return { value: buf.toString('utf8', next, next + n), next: next + n + 2 };
  }
  if (type === '*') {
    const n = Number(value);
    if (n === -1) return { value: null, next };
    let cursor = next;
    const arr = [];
    for (let j = 0; j < n; j++) {
      const parsed = parse(buf, cursor);
      if (!parsed) return null;
      arr.push(parsed.value);
      cursor = parsed.next;
    }
    return { value: arr, next: cursor };
  }
  throw new Error(`Unsupported Redis response ${type}`);
}

async function redis(...args) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({host: target.hostname, port: Number(target.port || 6379)});
    let parts = [];
    let settled = false;
    const finish = (err, value) => { if (!settled) { settled = true; socket.destroy(); err ? reject(err) : resolve(value); } };
    socket.setTimeout(['BLPOP','BRPOPLPUSH'].includes(args[0]) ? 16000 : 3500, () => finish(new Error('Redis timeout')));
    socket.on('error', err => finish(err));
    socket.on('connect', () => {
      const commands = [];
      if (target.password) commands.push(['AUTH', decodeURIComponent(target.password)]);
      if (target.pathname && target.pathname !== '/') commands.push(['SELECT', target.pathname.slice(1)]);
      commands.push(args);
      socket._pendingReplies = commands.length;
      const encoded = commands.map(c => '*' + c.length + '\r\n' + c.map(v => {const s = String(v); return '$' + Buffer.byteLength(s) + '\r\n' + s + '\r\n';}).join('')).join('');
      socket.write(encoded);
    });
    socket.on('data', chunk => {
      parts.push(chunk);
      let b = Buffer.concat(parts);
      try {
        while (b.length) {
          const p = parse(b);
          if (!p) break;
          b = b.subarray(p.next);
          if (--socket._pendingReplies === 0) { finish(null, p.value); return; }
        }
        parts = [b];
      } catch (err) { finish(err); }
    });
    socket.on('close', () => { if (!settled) finish(new Error('Redis closed connection')); });
  });
}

module.exports = { redis };
