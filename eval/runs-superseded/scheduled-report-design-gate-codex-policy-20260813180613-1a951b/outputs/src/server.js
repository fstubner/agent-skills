import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const schedules = new Map();
const frequencies = new Set(['daily', 'weekly']);

export function listActivity(accountId) { return [{ accountId, kind: 'login' }]; }

function accountFrom(request) {
  const value = request.headers['x-account-id'];
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : null;
}

function nextRun(frequency, from = new Date()) {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + (frequency === 'weekly' ? 7 : 1));
  return next.toISOString();
}

export function validateSchedule(input) {
  if (!input || typeof input !== 'object') throw new Error('A schedule object is required');
  if (typeof input.report !== 'string' || input.report.trim().length < 1 || input.report.length > 100) throw new Error('report is required and must be 100 characters or fewer');
  if (!frequencies.has(input.frequency)) throw new Error('frequency must be daily or weekly');
  if (!Array.isArray(input.recipients) || input.recipients.length < 1 || input.recipients.length > 20) throw new Error('recipients must contain 1 to 20 email addresses');
  for (const email of input.recipients) {
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('recipients must contain valid email addresses');
  }
}

export function createSchedule(accountId, input, now = new Date()) {
  validateSchedule(input);
  const schedule = { id: randomUUID(), accountId, report: input.report.trim(), frequency: input.frequency, recipients: [...new Set(input.recipients.map(email => email.trim().toLowerCase()))], enabled: input.enabled !== false, nextRunAt: nextRun(input.frequency, now), createdAt: now.toISOString() };
  schedules.set(schedule.id, schedule);
  return schedule;
}

export function schedulesFor(accountId) { return [...schedules.values()].filter(item => item.accountId === accountId); }

export function updateSchedule(accountId, id, input) {
  const current = schedules.get(id);
  if (!current || current.accountId !== accountId) return null;
  const merged = { ...current, ...input };
  validateSchedule(merged);
  const updated = { ...current, report: merged.report.trim(), frequency: merged.frequency, recipients: [...new Set(merged.recipients.map(email => email.trim().toLowerCase()))], enabled: merged.enabled !== false };
  if (updated.frequency !== current.frequency) updated.nextRunAt = nextRun(updated.frequency);
  schedules.set(id, updated);
  return updated;
}

export function dueSchedules(now = new Date()) {
  const due = [];
  for (const item of schedules.values()) if (item.enabled && new Date(item.nextRunAt) <= now) {
    due.push({ ...item });
    item.nextRunAt = nextRun(item.frequency, now);
  }
  return due;
}

function json(response, status, value) { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); }
async function body(request) { let data = ''; for await (const chunk of request) data += chunk; return JSON.parse(data || '{}'); }

export const ui = `<!doctype html><meta name="viewport" content="width=device-width"><title>Scheduled reports</title><style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:0 16px;color:#172033}form,article{border:1px solid #d9deea;border-radius:10px;padding:18px;margin:16px 0}label{display:block;margin:12px 0 5px}input,select,button{font:inherit;padding:9px;border:1px solid #aab4c8;border-radius:6px}input{width:95%}button{background:#2457d6;color:#fff;border:0;cursor:pointer}button.delete{background:#b3261e;float:right}li{margin:14px 0}.muted{color:#667085}</style><h1>Scheduled reports</h1><p class="muted">Configure an automatic activity report for your account.</p><form id="form"><label>Account ID<input id="account" required pattern="[A-Za-z0-9_-]+" value="demo"></label><label>Report<input id="report" required maxlength="100" value="Activity summary"></label><label>Frequency<select id="frequency"><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label><label>Recipients<input id="recipients" type="email" required placeholder="you@example.com, team@example.com"></label><button>Save schedule</button></form><section id="list"></section><script>const $=id=>document.getElementById(id);async function load(){const r=await fetch('/api/schedules',{headers:{'x-account-id':$('account').value}});const a=await r.json();$('list').innerHTML=a.length?'<h2>Your schedules</h2>'+a.map(x=>'<article><button class="delete" onclick="remove(\\''+x.id+'\\')">Delete</button><b>'+x.report+'</b><p>'+x.frequency+' · '+(x.enabled?'Enabled':'Paused')+'<br>Next run: '+new Date(x.nextRunAt).toLocaleString()+'<br>'+x.recipients.join(', ')+'</p></article>').join(''):'<p class="muted">No schedules yet.</p>'}async function remove(id){await fetch('/api/schedules/'+id,{method:'DELETE',headers:{'x-account-id':$('account').value}});load()}$('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/api/schedules',{method:'POST',headers:{'content-type':'application/json','x-account-id':$('account').value},body:JSON.stringify({report:$('report').value,frequency:$('frequency').value,recipients:$('recipients').value.split(',').map(x=>x.trim())})});if(!r.ok)alert((await r.json()).error);load()};$('account').onchange=load;load()</script>`;

export function createApp() { return createServer(async (request, response) => {
  if (request.url === '/' && request.method === 'GET') { response.writeHead(200, { 'content-type': 'text/html' }); response.end(ui); return; }
  if (!request.url.startsWith('/api/schedules')) return json(response, 404, { error: 'Not found' });
  const accountId = accountFrom(request); if (!accountId) return json(response, 401, { error: 'x-account-id is required' });
  const id = request.url.split('/')[3];
  try {
    if (request.method === 'GET' && !id) return json(response, 200, schedulesFor(accountId));
    if (request.method === 'POST' && !id) return json(response, 201, createSchedule(accountId, await body(request)));
    if (request.method === 'PATCH' && id) { const result = updateSchedule(accountId, id, await body(request)); return result ? json(response, 200, result) : json(response, 404, { error: 'Not found' }); }
    if (request.method === 'DELETE' && id) { const result = updateSchedule(accountId, id, { ...schedules.get(id), enabled: false }); return result ? json(response, 200, result) : json(response, 404, { error: 'Not found' }); }
    return json(response, 405, { error: 'Method not allowed' });
  } catch (error) { return json(response, 400, { error: error.message }); }
}); }

if (process.argv[1]?.endsWith('server.js')) createApp().listen(process.env.PORT || 3000);
