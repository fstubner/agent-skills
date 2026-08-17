import http from 'node:http';
import { randomUUID } from 'node:crypto';

export function listActivity(accountId) {
  return [{ accountId, kind: 'login' }];
}

const frequencies = new Set(['daily', 'weekly']);

export function createScheduleStore({ deliver = () => {} } = {}) {
  const schedules = new Map();

  function forAccount(accountId) {
    return [...schedules.values()].filter((item) => item.accountId === accountId);
  }

  function create(accountId, input) {
    const report = input?.report;
    const frequency = input?.frequency;
    const email = input?.email;
    if (!accountId || typeof accountId !== 'string') throw new Error('accountId is required');
    if (report !== 'activity') throw new Error('report must be activity');
    if (!frequencies.has(frequency)) throw new Error('frequency must be daily or weekly');
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) throw new Error('a valid email is required');
    const schedule = { id: randomUUID(), accountId, report, frequency, email, enabled: true, createdAt: new Date().toISOString() };
    schedules.set(schedule.id, schedule);
    return schedule;
  }

  function remove(accountId, id) {
    const schedule = schedules.get(id);
    if (!schedule || schedule.accountId !== accountId) return false;
    schedules.delete(id);
    return true;
  }

  function runDue() {
    // Delivery is deliberately injected: production can connect this to its mail provider.
    for (const schedule of schedules.values()) if (schedule.enabled) deliver({ schedule, rows: listActivity(schedule.accountId) });
  }

  return { create, list: forAccount, remove, runDue };
}

export function createServer({ store = createScheduleStore(), accountHeader = 'x-account-id' } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const accountId = request.headers[accountHeader];
    const send = (status, body, type = 'application/json') => {
      response.writeHead(status, { 'content-type': `${type}; charset=utf-8` });
      response.end(status === 204 ? undefined : type === 'text/html' ? body : JSON.stringify(body));
    };
    if (url.pathname === '/' && request.method === 'GET') return send(200, ui(), 'text/html');
    if (!accountId) return send(401, { error: 'x-account-id header is required' });
    if (url.pathname === '/api/activity' && request.method === 'GET') return send(200, { activity: listActivity(accountId) });
    if (url.pathname === '/api/schedules' && request.method === 'GET') return send(200, { schedules: store.list(accountId) });
    if (url.pathname === '/api/schedules' && request.method === 'POST') {
      try {
        const body = await readJson(request);
        return send(201, { schedule: store.create(accountId, body) });
      } catch (error) { return send(400, { error: error.message }); }
    }
    if (url.pathname.startsWith('/api/schedules/') && request.method === 'DELETE') {
      const removed = store.remove(accountId, url.pathname.split('/').pop());
      return send(removed ? 204 : 404, removed ? null : { error: 'schedule not found' });
    }
    send(404, { error: 'not found' });
  });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let data = '';
    request.on('data', (chunk) => { data += chunk; if (data.length > 10000) reject(new Error('request too large')); });
    request.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { reject(new Error('invalid JSON')); } });
    request.on('error', reject);
  });
}

function ui() {
  return `<!doctype html><meta name="viewport" content="width=device-width"><title>Scheduled reports</title>
  <style>body{font:16px system-ui;max-width:640px;margin:40px auto;padding:0 16px}form{display:grid;gap:10px;max-width:360px}input,select,button{font:inherit;padding:8px}li{margin:10px 0}button{cursor:pointer}</style>
  <h1>Scheduled reports</h1><p>Account: <input id="account" value="demo-account"></p>
  <form id="form"><label>Report <select name="report"><option value="activity">Activity</option></select></label>
  <label>Frequency <select name="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
  <label>Send to <input required type="email" name="email" placeholder="you@example.com"></label><button>Schedule report</button></form>
  <h2>Your schedules</h2><ul id="list"></ul><script>
  const accountInput=document.querySelector('#account'); const account=()=>accountInput.value.trim(); const headers=()=>({'x-account-id':account(),'content-type':'application/json'});
  async function load(){const r=await fetch('/api/schedules',{headers:headers()});const d=await r.json();list.innerHTML=d.schedules.map(s=>'<li>'+s.frequency+' activity → '+s.email+' <button onclick="remove(\\''+s.id+'\\')">Remove</button></li>').join('')||'<li>None yet</li>'}
  async function remove(id){await fetch('/api/schedules/'+id,{method:'DELETE',headers:headers()});load()}; form.onsubmit=async e=>{e.preventDefault();await fetch('/api/schedules',{method:'POST',headers:headers(),body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();load()}; accountInput.onchange=load; load();</script>`;
}

if (process.argv[1]?.endsWith('src/server.js')) createServer().listen(process.env.PORT || 3000, () => console.log('activity service listening'));
