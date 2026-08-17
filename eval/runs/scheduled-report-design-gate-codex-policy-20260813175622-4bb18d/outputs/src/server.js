import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const schedules = new Map();
const deliveries = [];

export function listActivity(accountId) { return [{ accountId, kind: 'login' }]; }

const allowedFrequencies = new Set(['daily', 'weekly']);
function accountFrom(req) {
  const accountId = req.headers['x-account-id'];
  if (!accountId || typeof accountId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(accountId)) return null;
  return accountId;
}
function validateSchedule(input) {
  if (!input || typeof input !== 'object') return 'A JSON object is required';
  if (typeof input.email !== 'string' || !/^\S+@\S+\.\S+$/.test(input.email) || input.email.length > 254) return 'A valid email is required';
  if (!allowedFrequencies.has(input.frequency)) return 'frequency must be daily or weekly';
  if (input.frequency === 'weekly' && !Number.isInteger(input.weekday) || input.frequency === 'weekly' && (input.weekday < 0 || input.weekday > 6)) return 'weekday must be 0-6 for weekly schedules';
  if (typeof input.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return 'time must be HH:MM in UTC';
  return null;
}
function publicSchedule(s) { return { ...s }; }
function json(res, status, value) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); }
async function body(req) {
  let raw = ''; for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || '{}'); } catch { return null; }
}
function due(s, now) {
  if (!s.enabled) return false;
  const [hour, minute] = s.time.split(':').map(Number);
  return now.getUTCHours() === hour && now.getUTCMinutes() === minute &&
    (s.frequency === 'daily' || now.getUTCDay() === s.weekday) &&
    (!s.lastDeliveredAt || new Date(s.lastDeliveredAt).toISOString().slice(0, 13) !== now.toISOString().slice(0, 13));
}

export function createApp({ send = async () => {} } = {}) {
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><meta name="viewport" content="width=device-width"><title>Scheduled reports</title><style>body{font:16px system-ui;max-width:640px;margin:40px auto;padding:0 16px}label{display:block;margin:14px 0}input,select,button{font:inherit;padding:8px}button{cursor:pointer}.card{border:1px solid #ddd;padding:14px;margin:12px 0;border-radius:8px}</style><h1>Scheduled reports</h1><p>Account: <input id="account" value="demo"></p><form id="form"><label>Email <input id="email" type="email" required></label><label>Frequency <select id="frequency"><option>daily</option><option>weekly</option></select></label><label>Day (weekly) <select id="weekday"><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option></select></label><label>Time (UTC) <input id="time" type="time" value="09:00" required></label><button>Save schedule</button></form><section id="list"></section><script>const $=id=>document.getElementById(id);async function load(){let r=await fetch('/api/schedules',{headers:{'x-account-id':$('account').value}});let a=await r.json();$('list').innerHTML=a.map(s=>'<div class="card"><b>'+s.frequency+' at '+s.time+' UTC</b><br>'+s.email+' — '+(s.enabled?'enabled':'paused')+' <button onclick="toggle(\''+s.id+'\','+!s.enabled+')">'+(s.enabled?'Pause':'Resume')+'</button> <button onclick="remove(\''+s.id+'\')">Delete</button></div>').join('')||'<p>No schedules yet.</p>'}async function toggle(id,enabled){await fetch('/api/schedules/'+id,{method:'PATCH',headers:{'content-type':'application/json','x-account-id':$('account').value},body:JSON.stringify({enabled})});load()}async function remove(id){await fetch('/api/schedules/'+id,{method:'DELETE',headers:{'x-account-id':$('account').value}});load()}$('form').onsubmit=async e=>{e.preventDefault();await fetch('/api/schedules',{method:'POST',headers:{'content-type':'application/json','x-account-id':$('account').value},body:JSON.stringify({email:$('email').value,frequency:$('frequency').value,weekday:Number($('weekday').value),time:$('time').value})});e.target.reset();$('time').value='09:00';load()};load();</script>`);
    }
    const url = new URL(req.url, 'http://localhost'); const match = url.pathname.match(/^\/api\/schedules(?:\/([^/]+))?$/);
    if (!match) return json(res, 404, { error: 'Not found' });
    const accountId = accountFrom(req); if (!accountId) return json(res, 401, { error: 'x-account-id is required' });
    const id = match[1];
    if (req.method === 'GET') return json(res, 200, [...schedules.values()].filter(s => s.accountId === accountId && (!id || s.id === id)).map(publicSchedule));
    if (req.method === 'POST' && !id) { const input = await body(req); const error = validateSchedule(input); if (error) return json(res, 400, { error }); const s = { id: randomUUID(), accountId, email: input.email, frequency: input.frequency, weekday: input.weekday ?? 1, time: input.time, enabled: true, lastDeliveredAt: null, createdAt: new Date().toISOString() }; schedules.set(s.id, s); return json(res, 201, publicSchedule(s)); }
    if (!id || !schedules.has(id) || schedules.get(id).accountId !== accountId) return json(res, 404, { error: 'Schedule not found' });
    if (req.method === 'DELETE') { schedules.delete(id); return json(res, 204, null); }
    if (req.method === 'PATCH') { const input = await body(req); const s = schedules.get(id); if ('enabled' in input && typeof input.enabled !== 'boolean') return json(res, 400, { error: 'enabled must be boolean' }); Object.assign(s, { enabled: input.enabled ?? s.enabled }); return json(res, 200, publicSchedule(s)); }
    return json(res, 405, { error: 'Method not allowed' });
  });
}

export async function runDueSchedules(now = new Date(), send = async () => {}) {
  let count = 0;
  for (const s of schedules.values()) if (due(s, now)) { await send({ to: s.email, accountId: s.accountId, report: listActivity(s.accountId) }); s.lastDeliveredAt = now.toISOString(); deliveries.push({ scheduleId: s.id, deliveredAt: s.lastDeliveredAt }); count++; }
  return count;
}
export function resetStore() { schedules.clear(); deliveries.length = 0; }
export function listDeliveries() { return [...deliveries]; }
