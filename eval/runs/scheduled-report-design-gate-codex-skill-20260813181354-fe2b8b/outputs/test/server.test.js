import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearReportSchedules, createReportSchedule, deleteReportSchedule,
  deliverDueReports, listActivity, listReportSchedules, updateReportSchedule,
} from '../src/server.js';

test.beforeEach(() => clearReportSchedules());

test('lists activity', () => assert.equal(listActivity('a')[0].accountId, 'a'));

test('customers can manage schedules', () => {
  const created = createReportSchedule({ accountId: 'a', recipients: ['owner@example.com'], frequency: 'daily' });
  assert.equal(listReportSchedules('a').length, 1);
  const updated = updateReportSchedule(created.id, { enabled: false, frequency: 'weekly' });
  assert.equal(updated.enabled, false);
  assert.equal(updated.frequency, 'weekly');
  assert.equal(deleteReportSchedule(created.id), true);
  assert.deepEqual(listReportSchedules('a'), []);
});

test('delivers due reports and advances the next run', async () => {
  const sent = [];
  const schedule = createReportSchedule({ accountId: 'a', recipients: ['owner@example.com'], frequency: 'daily', nextRunAt: '2026-01-01T09:00:00Z' });
  const result = await deliverDueReports({ now: '2026-01-01T10:00:00Z', send: (message) => sent.push(message) });
  assert.deepEqual(result, [schedule.id]);
  assert.equal(sent[0].report.activity[0].kind, 'login');
  assert.equal(listReportSchedules('a')[0].nextRunAt, '2026-01-02T09:00:00.000Z');
  assert.deepEqual(await deliverDueReports({ now: '2026-01-01T10:00:00Z', send: (message) => sent.push(message) }), []);
});

test('rejects incomplete schedules', () => {
  assert.throws(() => createReportSchedule({ accountId: 'a', recipients: [], frequency: 'daily' }), /recipient/);
  assert.throws(() => createReportSchedule({ accountId: 'a', recipients: ['bad'], frequency: 'monthly' }), /valid email|daily or weekly/);
});
