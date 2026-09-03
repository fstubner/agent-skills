import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const schedules = new Map();
const deliveries = [];
let activity = [];

export function listActivity(accountId) {
  return activity.filter((item) => item.accountId === accountId).length
    ? activity.filter((item) => item.accountId === accountId)
    : [{ accountId, kind: 'login' }];
}

export function createSchedule(input, now = new Date()) {
  if (!input?.accountId || !input?.recipient) throw new Error('accountId and recipient are required');
  if (!['daily', 'weekly'].includes(input.frequency)) throw new Error('frequency must be daily or weekly');
  const schedule = {
    id: randomUUID(), accountId: input.accountId, recipient: input.recipient,
    frequency: input.frequency, format: input.format === 'json' ? 'json' : 'csv',
    enabled: input.enabled !== false, nextRunAt: (input.nextRunAt || now).toISOString(),
    createdAt: now.toISOString(), lastRunAt: null
  };
  schedules.set(schedule.id, schedule);
  return { ...schedule };
}

export function listSchedules(accountId) {
  return [...schedules.values()].filter((s) => !accountId || s.accountId === accountId).map((s) => ({ ...s }));
}

export function updateSchedule(id, changes) {
  const current = schedules.get(id);
  if (!current) return null;
  if (changes.frequency && !['daily', 'weekly'].includes(changes.frequency)) throw new Error('frequency must be daily or weekly');
  Object.assign(current, Object.fromEntries(Object.entries(changes).filter(([key]) => ['recipient', 'frequency', 'format', 'enabled', 'nextRunAt'].includes(key))));
  if (current.format !== 'json') current.format = 'csv';
  return { ...current };
}

export function deleteSchedule(id) { return schedules.delete(id); }

function reportFor(accountId, format) {
  const rows = listActivity(accountId);
  return format === 'json' ? JSON.stringify(rows, null, 2) : ['accountId,kind', ...rows.map((r) => `${r.accountId},${r.kind}`)].join('\n');
}

export async function runDueSchedules(now = new Date(), deliver = defaultDeliver) {
  const sent = [];
  for (const schedule of schedules.values()) {
    if (!schedule.enabled || new Date(schedule.nextRunAt) > now) continue;
    const delivery = { scheduleId: schedule.id, recipient: schedule.recipient, accountId: schedule.accountId, format: schedule.format, body: reportFor(schedule.accountId, schedule.format), sentAt: now.toISOString() };
    await deliver(delivery);
    deliveries.push(delivery);
    schedule.lastRunAt = delivery.sentAt;
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + (schedule.frequency === 'weekly' ? 7 : 1));
    schedule.nextRunAt = next.toISOString();
    sent.push(delivery);
  }
  return sent;
}

async function defaultDeliver(delivery) { return delivery; }
export function listDeliveries() { return deliveries.map((d) => ({ ...d })); }

function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }
const dashboard = `<!doctype html><meta name="viewport" content="width=device-width"><title>Scheduled reports</title><style>body{font:16px system-ui;max-width:700px;margin:40px auto;padding:0 16px}input,select,button{padding:9px;margin:4px}li{margin:12px 0}</style><h1>Scheduled reports</h1><form id="form"><input name="accountId" placeholder="Account ID" required><input name="recipient" type="email" placeholder="Email" required><select name="frequency"><option>daily</option><option>weekly</option></select><select name="format"><option value="csv">CSV</option><option value="json">JSON</option></select><button>Schedule report</button></form><ul id="list"></ul><script>const f=document.querySelector('#form'),l=document.querySelector('#list');async function load(){let a=await fetch('/api/schedules').then(r=>r.json());l.innerHTML=a.map(s=>'<li><b>'+s.recipient+'</b> — '+s.frequency+' '+s.format+' (next: '+new Date(s.nextRunAt).toLocaleString()+') <button onclick="remove(\\''+s.id+'\\')">Delete</button></li>').join('')}f.onsubmit=async e=>{e.preventDefault();await fetch('/api/schedules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});f.reset();load()};async function remove(id){await fetch('/api/schedules/'+id,{method:'DELETE'});load()}load()</script>`;

export function createHttpServer() {
  return createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(dashboard); }
      if (req.method === 'GET' && req.url.startsWith('/api/schedules')) return json(res, 200, listSchedules(new URL(req.url, 'http://localhost').searchParams.get('accountId')));
      if (req.method === 'POST' && req.url === '/api/schedules') { const body = await readBody(req); return json(res, 201, createSchedule(body)); }
      if (req.method === 'DELETE' && req.url.startsWith('/api/schedules/')) return deleteSchedule(req.url.split('/').pop()) ? json(res, 204, {}) : json(res, 404, { error: 'schedule not found' });
      if (req.method === 'POST' && req.url === '/api/run-due') return json(res, 200, await runDueSchedules());
      json(res, 404, { error: 'not found' });
    } catch (error) { json(res, 400, { error: error.message }); }
  });
}
function readBody(req) { return new Promise((resolve, reject) => { let raw = ''; req.on('data', (c) => raw += c); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('invalid JSON')); } }); }); }

if (process.env.NODE_ENV !== 'test' && process.env.PORT) {
  createHttpServer().listen(process.env.PORT);
  const scheduler = setInterval(() => runDueSchedules().catch(() => {}), 60_000);
  scheduler.unref();
}
