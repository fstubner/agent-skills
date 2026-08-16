import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

export function listActivity(accountId) {
  return [{ accountId, kind: 'login' }];
}

const frequencies = new Set(['daily', 'weekly']);

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let value = '';
    req.on('data', chunk => { value += chunk; if (value.length > 100_000) reject(new Error('body too large')); });
    req.on('end', () => { try { resolve(value ? JSON.parse(value) : {}); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

function validUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.hostname === 'localhost'; } catch { return false; }
}

export function createService({ deliver = async () => {}, now = () => new Date(), activities = listActivity } = {}) {
  const schedules = new Map();
  const deliveries = [];

  function due(schedule) {
    return new Date(schedule.nextRunAt).getTime() <= now().getTime();
  }
  async function runDue() {
    for (const schedule of schedules.values()) {
      if (!schedule.enabled || !due(schedule)) continue;
      const report = { type: 'activity_report', accountId: schedule.accountId, generatedAt: now().toISOString(), activity: activities(schedule.accountId) };
      try {
        await deliver(schedule.destination, report);
        deliveries.push({ scheduleId: schedule.id, deliveredAt: report.generatedAt });
      } catch (error) {
        schedule.lastError = error.message;
      }
      const next = new Date(schedule.nextRunAt);
      next.setUTCDate(next.getUTCDate() + (schedule.frequency === 'weekly' ? 7 : 1));
      schedule.nextRunAt = next.toISOString();
    }
  }
  const interval = setInterval(() => runDue().catch(() => {}), 60_000);
  interval.unref?.();

  return {
    schedules,
    deliveries,
    async create(accountId, input) {
      if (!accountId || !frequencies.has(input.frequency) || !validUrl(input.destination)) throw new Error('frequency must be daily or weekly and destination must be an HTTPS URL');
      const first = input.nextRunAt ? new Date(input.nextRunAt) : new Date(now().getTime() + 24 * 60 * 60 * 1000);
      if (Number.isNaN(first.getTime()) || first <= now()) throw new Error('nextRunAt must be a future ISO date');
      const schedule = { id: randomUUID(), accountId, frequency: input.frequency, destination: input.destination, nextRunAt: first.toISOString(), enabled: input.enabled !== false };
      schedules.set(schedule.id, schedule); return schedule;
    },
    list(accountId) { return [...schedules.values()].filter(s => s.accountId === accountId); },
    remove(accountId, id) { const s = schedules.get(id); if (!s || s.accountId !== accountId) return false; schedules.delete(id); return true; },
    runDue,
    close() { clearInterval(interval); }
  };
}

export function createApp(service = createService()) {
  return createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><title>Scheduled reports</title><h1>Scheduled reports</h1><p>Configure a daily or weekly activity report delivered to an HTTPS webhook.</p><form id="f"><input name="accountId" placeholder="Account ID" required><select name="frequency"><option>daily</option><option>weekly</option></select><input name="destination" type="url" placeholder="https://example.com/report-hook" required><input name="nextRunAt" type="datetime-local"><button>Save schedule</button></form><pre id="out"></pre><script>f.onsubmit=async e=>{e.preventDefault();let x=Object.fromEntries(new FormData(f));if(x.nextRunAt)x.nextRunAt=new Date(x.nextRunAt).toISOString();let r=await fetch('/api/schedules',{method:'POST',headers:{'content-type':'application/json','x-account-id':x.accountId},body:JSON.stringify(x)});out.textContent=await r.text()}</script>`);
    }
    const match = req.url?.match(/^\/api\/schedules(?:\/([^/]+))?$/);
    if (!match) return json(res, 404, { error: 'not found' });
    const accountId = req.headers['x-account-id'];
    if (typeof accountId !== 'string' || !accountId) return json(res, 401, { error: 'x-account-id is required' });
    try {
      if (req.method === 'GET') return json(res, 200, service.list(accountId));
      if (req.method === 'POST' && !match[1]) return json(res, 201, await service.create(accountId, await readBody(req)));
      if (req.method === 'DELETE' && match[1]) return json(res, service.remove(accountId, match[1]) ? 204 : 404, {});
      return json(res, 405, { error: 'method not allowed' });
    } catch (error) { return json(res, 400, { error: error.message }); }
  });
}

export function startServer(port = process.env.PORT || 3000, service = createService({ deliver: async (destination, report) => { const response = await fetch(destination, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) }); if (!response.ok) throw new Error(`delivery failed (${response.status})`); } })) {
  const server = createApp(service).listen(port, () => console.log(`activity service listening on ${port}`));
  return server;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) startServer();
