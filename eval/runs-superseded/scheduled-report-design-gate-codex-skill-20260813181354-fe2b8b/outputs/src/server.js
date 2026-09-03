const schedules = new Map();
let nextScheduleId = 1;

export function listActivity(accountId) {
  return [{ accountId, kind: 'login' }];
}

function validateSchedule(input) {
  if (!input || typeof input !== 'object') throw new TypeError('schedule is required');
  if (!input.accountId) throw new Error('accountId is required');
  if (!Array.isArray(input.recipients) || input.recipients.length === 0) {
    throw new Error('at least one recipient is required');
  }
  if (input.recipients.some((email) => typeof email !== 'string' || !email.includes('@'))) {
    throw new Error('recipients must contain valid email addresses');
  }
  if (!['daily', 'weekly'].includes(input.frequency)) {
    throw new Error('frequency must be daily or weekly');
  }
  const nextRunAt = new Date(input.nextRunAt ?? Date.now());
  if (Number.isNaN(nextRunAt.getTime())) throw new Error('nextRunAt must be a valid date');
  return {
    accountId: input.accountId,
    recipients: [...input.recipients],
    frequency: input.frequency,
    nextRunAt: nextRunAt.toISOString(),
    enabled: input.enabled !== false,
  };
}

export function createReportSchedule(input) {
  const schedule = { id: String(nextScheduleId++), ...validateSchedule(input) };
  schedules.set(schedule.id, schedule);
  return { ...schedule, recipients: [...schedule.recipients] };
}

export function listReportSchedules(accountId) {
  return [...schedules.values()]
    .filter((schedule) => accountId === undefined || schedule.accountId === accountId)
    .map((schedule) => ({ ...schedule, recipients: [...schedule.recipients] }));
}

export function updateReportSchedule(id, changes) {
  const current = schedules.get(String(id));
  if (!current) throw new Error('schedule not found');
  const updated = { ...current, ...validateSchedule({ ...current, ...changes }) , id: current.id };
  schedules.set(current.id, updated);
  return { ...updated, recipients: [...updated.recipients] };
}

export function deleteReportSchedule(id) {
  return schedules.delete(String(id));
}

function advance(date, frequency) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + (frequency === 'weekly' ? 7 : 1));
  return next.toISOString();
}

export async function deliverDueReports({ now = new Date(), send = defaultSend } = {}) {
  const timestamp = new Date(now);
  if (Number.isNaN(timestamp.getTime())) throw new Error('now must be a valid date');
  const delivered = [];
  for (const schedule of schedules.values()) {
    if (!schedule.enabled || new Date(schedule.nextRunAt) > timestamp) continue;
    const report = { accountId: schedule.accountId, activity: listActivity(schedule.accountId) };
    await send({ to: schedule.recipients, subject: 'Your activity report', report });
    schedule.nextRunAt = advance(schedule.nextRunAt, schedule.frequency);
    delivered.push(schedule.id);
  }
  return delivered;
}

async function defaultSend() {
  throw new Error('No report delivery provider configured');
}

export function clearReportSchedules() {
  schedules.clear();
  nextScheduleId = 1;
}
