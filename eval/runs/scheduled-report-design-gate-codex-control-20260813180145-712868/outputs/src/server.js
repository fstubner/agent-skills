import http from 'node:http';
import { randomUUID } from 'node:crypto';

// The activity store is intentionally small for the first version. Replace these
// functions with the application's database queries when one is introduced.
export function listActivity(accountId) {
  return [{ accountId, kind: 'login' }];
}

export function createReportService({ deliver = defaultDeliver, now = () => new Date() } = {}) {
  const schedules = new Map();
  const deliveries = [];

  function validate(input, existing = {}) {
    const value = { ...existing, ...input };
    if (!value.accountId || !value.email) throw new Error('accountId and email are required');
    if (!/^\S+@\S+\.\S+$/.test(value.email)) throw new Error('email is invalid');
    if (!['daily', 'weekly'].includes(value.frequency)) throw new Error('frequency must be daily or weekly');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time ?? '09:00')) throw new Error('time must be HH:MM');
    if (value.frequency === 'weekly' && (!Number.isInteger(value.weekday ?? 1) || value.weekday < 0 || value.weekday > 6)) throw new Error('weekday must be 0-6');
    return { accountId: value.accountId, email: value.email, frequency: value.frequency,
      time: value.time ?? '09:00', weekday: value.weekday ?? 1, enabled: value.enabled !== false };
  }

  function due(schedule, date = now()) {
    if (!schedule.enabled) return false;
    if (schedule.lastSentAt) {
      const last = new Date(schedule.lastSentAt);
      const sameDay = last.toISOString().slice(0, 10) === date.toISOString().slice(0, 10);
      if (schedule.frequency === 'daily' && sameDay) return false;
      if (schedule.frequency === 'weekly' && sameDay) return false;
    }
    const [hour, minute] = schedule.time.split(':').map(Number);
    return date.getUTCHours() === hour && date.getUTCMinutes() === minute &&
      (schedule.frequency === 'daily' || date.getUTCDay() === schedule.weekday);
  }

  async function send(schedule) {
    const report = { accountId: schedule.accountId, generatedAt: now().toISOString(), activity: listActivity(schedule.accountId) };
    await deliver({ to: schedule.email, subject: 'Your activity report', report });
    schedule.lastSentAt = now().toISOString();
    deliveries.push({ id: randomUUID(), scheduleId: schedule.id, to: schedule.email, sentAt: schedule.lastSentAt });
    return report;
  }

  return {
    listSchedules: accountId => [...schedules.values()].filter(s => !accountId || s.accountId === accountId),
    getSchedule: id => schedules.get(id),
    createSchedule(input) { const schedule = { id: randomUUID(), ...validate(input), createdAt: now().toISOString() }; schedules.set(schedule.id, schedule); return schedule; },
    updateSchedule(id, input) { const old = schedules.get(id); if (!old) return null; const next = { ...old, ...validate(input, old) }; schedules.set(id, next); return next; },
    deleteSchedule: id => schedules.delete(id),
    listDeliveries: () => [...deliveries],
    run: async (id) => { const schedule = schedules.get(id); if (!schedule) return null; return send(schedule); },
    tick: async () => { const sent = []; for (const schedule of schedules.values()) if (due(schedule)) sent.push(await send(schedule)); return sent; }
  };
}

async function defaultDeliver({ to, subject, report }) {
  // This is the pluggable boundary for SMTP/provider integration. Keeping the
  // payload in the process makes local development useful without credentials.
  console.log(JSON.stringify({ delivery: 'report', to, subject, report }));
}

const html = `<!doctype html><meta name="viewport" content="width=device-width"><title>Scheduled reports</title>
<style>body{font:16px system-ui;max-width:720px;margin:40px auto;padding:0 18px}input,select,button{padding:9px;margin:4px 0 12px;width:100%;box-sizing:border-box}button{cursor:pointer;background:#1463d6;color:#fff;border:0;border-radius:4px}li{margin:10px 0;padding:12px;background:#f3f4f6;border-radius:5px}.row{display:flex;gap:10px}.row>*{flex:1}</style>
<h1>Scheduled reports</h1><p>Receive an activity report by email on a daily or weekly schedule (times are UTC).</p>
<form id="form"><label>Account ID<input name="accountId" required placeholder="account-123"></label><label>Email<input name="email" type="email" required></label><div class="row"><label>Frequency<select name="frequency"><option>daily</option><option>weekly</option></select></label><label>Time (UTC)<input name="time" type="time" value="09:00"></label><label>Weekday<input name="weekday" type="number" min="0" max="6" value="1"></label></div><button>Save schedule</button></form><h2>Configured schedules</h2><ul id="list"></ul>
<script>const f=document.querySelector('#form'),l=document.querySelector('#list');async function load(){let a=await fetch('/api/report-schedules').then(r=>r.json());l.innerHTML=a.map(s=>'<li><b>'+s.email+'</b> — '+s.frequency+' at '+s.time+' UTC ('+s.accountId+') <button onclick="run(\\''+s.id+'\\')">Send now</button> <button onclick="remove(\\''+s.id+'\\')">Delete</button></li>').join('')||'<li>No schedules yet.</li>'}f.onsubmit=async e=>{e.preventDefault();let o=Object.fromEntries(new FormData(f));o.weekday=Number(o.weekday);await fetch('/api/report-schedules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(o)});f.reset();load()};async function run(id){await fetch('/api/report-schedules/'+id+'/run',{method:'POST'});alert('Report delivered');load()}async function remove(id){await fetch('/api/report-schedules/'+id,{method:'DELETE'});load()}load()</script>`;

export function createServer(service = createReportService()) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const json = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
    if (req.method === 'GET' && url.pathname === '/api/report-schedules') return json(200, service.listSchedules(url.searchParams.get('accountId')));
    if (req.method === 'POST' && url.pathname === '/api/report-schedules') {
      try { return json(201, service.createSchedule(await readJson(req))); } catch (e) { return json(400, { error: e.message }); }
    }
    const match = url.pathname.match(/^\/api\/report-schedules\/([^/]+)(\/run)?$/);
    if (!match) return json(404, { error: 'not found' });
    const id = match[1];
    try {
      if (req.method === 'POST' && match[2]) return json(200, { report: await service.run(id) });
      if (req.method === 'DELETE') return json(service.deleteSchedule(id) ? 204 : 404, {});
      if (req.method === 'PATCH') { const body = await readJson(req); const result = service.updateSchedule(id, body); return result ? json(200, result) : json(404, { error: 'not found' }); }
      return json(405, { error: 'method not allowed' });
    } catch (e) { return json(400, { error: e.message }); }
  });
}
function readJson(req) { return new Promise((resolve, reject) => { let body = ''; req.on('data', c => body += c); req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('invalid JSON')); } }); }); }

if (process.argv[1]?.endsWith('server.js')) { const service = createReportService(); const server = createServer(service); server.listen(process.env.PORT || 3000, () => console.log('activity service listening on port ' + (process.env.PORT || 3000))); setInterval(() => service.tick().catch(console.error), 60_000); }
