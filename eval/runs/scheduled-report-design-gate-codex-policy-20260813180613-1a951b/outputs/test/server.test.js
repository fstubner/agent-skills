import test from 'node:test'; import assert from 'node:assert/strict';
import { listActivity, createSchedule, schedulesFor, updateSchedule, dueSchedules } from '../src/server.js';

test('lists activity', () => assert.equal(listActivity('a')[0].accountId, 'a'));
test('creates and lists a validated schedule', () => {
  const schedule = createSchedule('account-test', { report: 'Weekly activity', frequency: 'weekly', recipients: ['OWNER@EXAMPLE.COM'] }, new Date('2026-01-01T00:00:00Z'));
  assert.equal(schedule.recipients[0], 'owner@example.com');
  assert.equal(schedule.nextRunAt, '2026-01-08T00:00:00.000Z');
  assert.equal(schedulesFor('other-account').some(item => item.id === schedule.id), false);
});
test('rejects invalid recipients', () => assert.throws(() => createSchedule('a', { report: 'x', frequency: 'daily', recipients: ['not-an-email'] })));
test('cannot update another account schedule and due schedules advance', () => {
  const schedule = createSchedule('owner', { report: 'x', frequency: 'daily', recipients: ['a@example.com'] }, new Date('2026-01-01T00:00:00Z'));
  assert.equal(updateSchedule('intruder', schedule.id, { report: 'changed' }), null);
  const due = dueSchedules(new Date('2026-01-02T00:00:00Z'));
  assert.equal(due.some(item => item.id === schedule.id), true);
  assert.equal(schedulesFor('owner').find(item => item.id === schedule.id).nextRunAt, '2026-01-03T00:00:00.000Z');
});
