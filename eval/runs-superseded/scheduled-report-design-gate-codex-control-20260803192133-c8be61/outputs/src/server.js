import { createServer as createHttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function listActivity(accountId) { return [{ accountId, kind: 'login' }]; }

const reports = [
  { id: 'activity-summary', name: 'Activity summary', description: 'A summary of account activity.' },
  { id: 'account-health', name: 'Account health', description: 'Usage and health signals for your account.' },
];
const schedules = new Map();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function listReports() { return reports; }

function validateSchedule(input) {
  const value = { ...input };
  if (!value.reportId || !reports.some(report => report.id === value.reportId)) throw new Error('Choose a valid report.');
  if (!Array.isArray(value.recipients) || value.recipients.length === 0 || value.recipients.some(email => !emailPattern.test(email))) {
    throw new Error('Add at least one valid recipient email.');
  }
  if (!['daily', 'weekly'].includes(value.frequency)) throw new Error('Frequency must be daily or weekly.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time || '')) throw new Error('Time must use HH:MM format.');
  if (value.frequency === 'weekly' && (!Number.isInteger(value.dayOfWeek) || value.dayOfWeek < 0 || value.dayOfWeek > 6)) {
    throw new Error('Choose a day for weekly delivery.');
  }
  return {
    reportId: value.reportId,
    recipients: [...new Set(value.recipients.map(email => email.trim().toLowerCase()))],
    frequency: value.frequency,
    dayOfWeek: value.frequency === 'weekly' ? value.dayOfWeek : undefined,
    time: value.time,
    timezone: 'UTC',
  };
}

export function nextRunAt(schedule, from = new Date()) {
  const [hours, minutes] = schedule.time.split(':').map(Number);
  const candidate = new Date(from);
  candidate.setUTCHours(hours, minutes, 0, 0);
  if (schedule.frequency === 'weekly') {
    let days = (schedule.dayOfWeek - candidate.getUTCDay() + 7) % 7;
    if (days === 0 && candidate <= from) days = 7;
    candidate.setUTCDate(candidate.getUTCDate() + days);
  } else if (candidate <= from) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate.toISOString();
}

function publicSchedule(schedule) {
  return { ...schedule, recipients: [...schedule.recipients] };
}

export function listSchedules(accountId = 'default') {
  return [...schedules.values()].filter(item => item.accountId === accountId).map(publicSchedule);
}

export function createSchedule(input, accountId = 'default', now = new Date()) {
  const value = validateSchedule(input);
  const schedule = {
    id: randomUUID(), accountId, active: true, createdAt: now.toISOString(), updatedAt: now.toISOString(),
    ...value, nextRunAt: nextRunAt(value, now), lastDeliveredAt: null,
  };
  schedules.set(schedule.id, schedule);
  return publicSchedule(schedule);
}

export function updateSchedule(id, input, accountId = 'default', now = new Date()) {
  const current = schedules.get(id);
  if (!current || current.accountId !== accountId) return null;
  if (typeof input.active === 'boolean' && Object.keys(input).length === 1) return setScheduleActive(id, input.active, accountId, now);
  const value = validateSchedule({ ...current, ...input });
  Object.assign(current, value, { active: typeof input.active === 'boolean' ? input.active : current.active, updatedAt: now.toISOString(), nextRunAt: nextRunAt(value, now) });
  return publicSchedule(current);
}

export function deleteSchedule(id, accountId = 'default') {
  const item = schedules.get(id);
  return Boolean(item && item.accountId === accountId && schedules.delete(id));
}

export function setScheduleActive(id, active, accountId = 'default', now = new Date()) {
  const item = schedules.get(id);
  if (!item || item.accountId !== accountId) return null;
  item.active = Boolean(active);
  item.updatedAt = now.toISOString();
  if (item.active) item.nextRunAt = nextRunAt(item, now);
  return publicSchedule(item);
}

export function deliverDueReports(now = new Date(), send = () => {}) {
  const deliveries = [];
  for (const item of schedules.values()) {
    if (!item.active || new Date(item.nextRunAt) > now) continue;
    const report = reports.find(candidate => candidate.id === item.reportId);
    const delivery = { scheduleId: item.id, reportId: item.reportId, reportName: report.name, recipients: [...item.recipients], deliveredAt: now.toISOString() };
    send(delivery);
    item.lastDeliveredAt = delivery.deliveredAt;
    item.nextRunAt = nextRunAt(item, now);
    deliveries.push(delivery);
  }
  return deliveries;
}

const json = (response, status, body) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(body)); };
async function body(request) {
  let raw = ''; for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

export function createServer() {
  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const accountId = request.headers['x-account-id'] || 'default';
      if (url.pathname === '/' && request.method === 'GET') {
        const html = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/index.html'));
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(html); return;
      }
      if (url.pathname === '/api/reports' && request.method === 'GET') return json(response, 200, { reports: listReports() });
      if (url.pathname === '/api/schedules' && request.method === 'GET') return json(response, 200, { schedules: listSchedules(accountId) });
      if (url.pathname === '/api/schedules' && request.method === 'POST') return json(response, 201, { schedule: createSchedule(await body(request), accountId) });
      const match = url.pathname.match(/^\/api\/schedules\/([^/]+)$/);
      if (match) {
        const id = match[1];
        if (request.method === 'DELETE') {
          const deleted = deleteSchedule(id, accountId);
          return json(response, deleted ? 200 : 404, { ok: deleted });
        }
        if (request.method === 'PATCH') {
          const schedule = updateSchedule(id, await body(request), accountId);
          return json(response, schedule ? 200 : 404, { schedule });
        }
      }
      json(response, 404, { error: 'Not found' });
    } catch (error) { json(response, 400, { error: error.message }); }
  });
}

if (typeof process !== 'undefined' && process.argv[1] === fileURLToPath(import.meta.url)) createServer().listen(process.env.PORT || 3000, () => console.log('Activity service listening on http://localhost:3000'));
