import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchedule, listActivity, runDueSchedules } from '../src/server.js';

test('lists activity', () => assert.equal(listActivity('a')[0].accountId, 'a'));

test('delivers a due email schedule and advances it', async () => {
  const sent = [];
  const schedule = createSchedule({ accountId: 'a', destination: 'owner@example.com', frequency: 'daily', nextRunAt: '2020-01-01T00:00:00.000Z' });
  const count = await runDueSchedules({ now: new Date('2020-01-02T00:00:00.000Z'), sendEmail: async (message) => sent.push(message) });
  assert.equal(count, 1);
  assert.equal(sent[0].to, 'owner@example.com');
  assert.equal(sent[0].report.activity[0].accountId, 'a');
  assert.equal(schedule.nextRunAt, '2020-01-03T00:00:00.000Z');
});

test('rejects invalid frequency', () => assert.throws(() => createSchedule({ accountId: 'a', destination: 'a@b.com', frequency: 'hourly' }), /daily or weekly/));
