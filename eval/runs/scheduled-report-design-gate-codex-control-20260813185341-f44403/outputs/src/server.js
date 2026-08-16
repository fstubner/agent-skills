import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

// The in-memory store is deliberate for the first useful version. Replace it with a
// database-backed implementation without changing the HTTP contract.
const schedules = new Map();

export function listActivity(accountId) {
  return [{ accountId, kind: 'login' }];
}

export function buildReport(accountId) {
  const activity = listActivity(accountId);
  return {
    accountId,
    generatedAt: new Date().toISOString(),
    activity,
    summary: { totalEvents: activity.length }
  };
}

function validate(input = {}) {
  if (!input.accountId || typeof input.accountId !== 'string') throw new Error('accountId is required');
  if (!input.destination || typeof input.destination !== 'string') throw new Error('destination is required');
  if (!['email', 'webhook'].includes(input.channel)) throw new Error('channel must be email or webhook');
  if (!/^\d{2}:\d{2}$/.test(input.time || '')) throw new Error('time must use HH:MM');
  const [hour, minute] = input.time.split(':').map(Number);
  if (hour > 23 || minute > 59) throw new Error('time must use HH:MM');
  if (input.frequency && !['daily', 'weekly'].includes(input.frequency)) throw new Error('frequency must be daily or weekly');
}

export function createSchedule(input) {
  validate(input);
  const schedule = {
    id: randomUUID(), accountId: input.accountId, channel: input.channel,
    destination: input.destination, frequency: input.frequency || 'daily',
    time: input.time, dayOfWeek: input.dayOfWeek == null ? 1 : Number(input.dayOfWeek),
    enabled: input.enabled !== false, lastDeliveredAt: null, createdAt: new Date().toISOString()
  };
  if (!Number.isInteger(schedule.dayOfWeek) || schedule.dayOfWeek < 0 || schedule.dayOfWeek > 6) throw new Error('dayOfWeek must be 0-6');
  schedules.set(schedule.id, schedule);
  return { ...schedule };
}

export function listSchedules(accountId) {
  return [...schedules.values()].filter(s => !accountId || s.accountId === accountId).map(s => ({ ...s }));
}

export function deleteSchedule(id, accountId) {
  const schedule = schedules.get(id);
  if (!schedule || (accountId && schedule.accountId !== accountId)) return false;
  schedules.delete(id); return true;
}

function isDue(schedule, now) {
  if (!schedule.enabled) return false;
  const day = now.getUTCDay();
  if (schedule.frequency === 'weekly' && day !== schedule.dayOfWeek) return false;
  if (schedule.time !== `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}`) return false;
  return !schedule.lastDeliveredAt || !schedule.lastDeliveredAt.startsWith(now.toISOString().slice(0, 10));
}

export async function runDueSchedules({ now = new Date(), deliver = defaultDeliver } = {}) {
  const delivered = [];
  for (const schedule of schedules.values()) {
    if (!isDue(schedule, now)) continue;
    const report = buildReport(schedule.accountId);
    await deliver(schedule, report);
    schedule.lastDeliveredAt = now.toISOString();
    delivered.push({ id: schedule.id, report });
  }
  return delivered;
}

async function defaultDeliver(schedule, report) {
  // No provider credentials are assumed. This hook logs a delivery and is replaceable.
  console.log(JSON.stringify({ type: 'scheduled-report', channel: schedule.channel, destination: schedule.destination, report }));
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(body));
}

const html = `<!doctype html><title>Scheduled reports</title><h1>Scheduled reports</h1>
<form id="f"><input name="accountId" placeholder="Account ID" required><select name="channel"><option>email</option><option>webhook</option></select><input name="destination" placeholder="Email or webhook URL" required><select name="frequency"><option>daily</option><option>weekly</option></select><input name="time" type="time" required><button>Create schedule</button></form><pre id="out"></pre>
<script>const f=document.querySelector('#f'),o=document.querySelector('#out');async function load(){const r=await fetch('/api/schedules?accountId='+encodeURIComponent(f.accountId.value));o.textContent=JSON.stringify(await r.json(),null,2)}f.accountId.onchange=load;f.onsubmit=async e=>{e.preventDefault();await fetch('/api/schedules',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(f)))});load()};</script>`;

export function createApp() {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method === 'GET' && url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html); }
      if (req.method === 'GET' && url.pathname === '/api/schedules') return json(res, 200, listSchedules(url.searchParams.get('accountId')));
      if (req.method === 'POST' && url.pathname === '/api/schedules') {
        let raw = ''; for await (const chunk of req) raw += chunk;
        return json(res, 201, createSchedule(JSON.parse(raw)));
      }
      const match = url.pathname.match(/^\/api\/schedules\/([^/]+)$/);
      if (match && req.method === 'DELETE') return deleteSchedule(match[1], url.searchParams.get('accountId')) ? json(res, 204, {}) : json(res, 404, { error: 'schedule not found' });
      json(res, 404, { error: 'not found' });
    } catch (error) { json(res, 400, { error: error.message }); }
  });
}

export function startScheduler({ intervalMs = 60_000, deliver } = {}) {
  const timer = setInterval(() => runDueSchedules({ deliver }).catch(console.error), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
