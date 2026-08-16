import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const schedules = new Map();
const deliveries = [];

export function listActivity(accountId) {
  return [{ accountId, kind: 'login' }];
}

function nextRun(frequency, from = new Date()) {
  const date = new Date(from);
  if (frequency === 'daily') date.setUTCDate(date.getUTCDate() + 1);
  else date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString();
}

export function createSchedule(input) {
  if (!input?.accountId || !input.destination || !input.frequency) throw new Error('accountId, destination, and frequency are required');
  if (!['daily', 'weekly'].includes(input.frequency)) throw new Error('frequency must be daily or weekly');
  if (!/^\S+@\S+\.\S+$/.test(input.destination) && !/^https?:\/\//.test(input.destination)) throw new Error('destination must be an email address or http(s) URL');
  const schedule = { id: randomUUID(), accountId: input.accountId, destination: input.destination, frequency: input.frequency, enabled: input.enabled !== false, nextRunAt: input.nextRunAt || nextRun(input.frequency), createdAt: new Date().toISOString() };
  schedules.set(schedule.id, schedule);
  return schedule;
}

export function listSchedules(accountId) {
  return [...schedules.values()].filter((s) => !accountId || s.accountId === accountId);
}

export function updateSchedule(id, changes) {
  const current = schedules.get(id);
  if (!current) return null;
  if (changes.frequency && !['daily', 'weekly'].includes(changes.frequency)) throw new Error('frequency must be daily or weekly');
  Object.assign(current, changes, { id: current.id, accountId: current.accountId });
  return current;
}

export function deleteSchedule(id) { return schedules.delete(id); }

export async function runDueSchedules({ now = new Date(), sendEmail = async () => {}, fetchImpl = fetch } = {}) {
  const reportDate = now.toISOString();
  const due = listSchedules().filter((s) => s.enabled && new Date(s.nextRunAt) <= now);
  for (const schedule of due) {
    const report = { accountId: schedule.accountId, generatedAt: reportDate, activity: listActivity(schedule.accountId) };
    if (schedule.destination.startsWith('http')) {
      const response = await fetchImpl(schedule.destination, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) });
      if (!response.ok) throw new Error(`webhook delivery failed (${response.status})`);
    } else await sendEmail({ to: schedule.destination, subject: `Activity report for ${schedule.accountId}`, report });
    deliveries.push({ scheduleId: schedule.id, deliveredAt: reportDate, destination: schedule.destination });
    schedule.nextRunAt = nextRun(schedule.frequency, now);
  }
  return due.length;
}

function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }
async function body(req) { let data = ''; for await (const chunk of req) data += chunk; return data ? JSON.parse(data) : {}; }
const page = `<!doctype html><meta name="viewport" content="width=device-width"><title>Scheduled reports</title><style>body{font:16px system-ui;max-width:640px;margin:40px auto;padding:0 16px}label{display:block;margin:14px 0}input,select,button{font:inherit;padding:8px;width:100%;box-sizing:border-box}button{cursor:pointer;margin-top:8px}li{margin:12px 0;padding:10px;background:#f2f2f2}</style><h1>Scheduled reports</h1><form id="form"><label>Account <input name="accountId" required></label><label>Send to (email or webhook URL) <input name="destination" required></label><label>Frequency <select name="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><button>Save schedule</button></form><h2>Schedules</h2><ul id="list"></ul><script>const f=document.querySelector('form'),l=document.querySelector('#list');async function load(){let x=await fetch('/api/schedules');let a=await x.json();l.innerHTML=a.map(s=>'<li><b>'+s.frequency+'</b> → '+s.destination+'<br>Account: '+s.accountId+'<br>Next: '+new Date(s.nextRunAt).toLocaleString()+' <button onclick="remove(\\''+s.id+'\\')">Delete</button></li>').join('')||'<li>No schedules yet.</li>'}f.onsubmit=async e=>{e.preventDefault();await fetch('/api/schedules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});f.reset();load()};async function remove(id){await fetch('/api/schedules/'+id,{method:'DELETE'});load()}load()</script>`;

export function createHttpServer() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost'); const match = url.pathname.match(/^\/api\/schedules\/?([^/]*)$/);
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(page); }
      if (match && req.method === 'GET') return json(res, 200, listSchedules(url.searchParams.get('accountId')));
      if (match && req.method === 'POST' && !match[1]) return json(res, 201, createSchedule(await body(req)));
      if (match && match[1] && req.method === 'PATCH') { const result = updateSchedule(match[1], await body(req)); return result ? json(res, 200, result) : json(res, 404, { error: 'schedule not found' }); }
      if (match && match[1] && req.method === 'DELETE') return json(res, deleteSchedule(match[1]) ? 204 : 404, {});
      json(res, 404, { error: 'not found' });
    } catch (error) { json(res, 400, { error: error.message }); }
  });
}

if (process.argv[1] && process.argv[1].endsWith('/src/server.js')) createHttpServer().listen(process.env.PORT || 3000, () => console.log('activity service listening on port ' + (process.env.PORT || 3000)));
