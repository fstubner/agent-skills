import test from 'node:test';
import assert from 'node:assert/strict';
import { createService, listActivity } from '../src/server.js';

test('lists activity', () => assert.equal(listActivity('a')[0].accountId, 'a'));

test('creates and runs an owned schedule', async () => {
  let clock = new Date('2026-01-01T00:00:00Z'); const sent = [];
  const service = createService({ now: () => clock, deliver: async (...args) => sent.push(args) });
  const schedule = await service.create('acct-1', { frequency: 'daily', destination: 'https://hooks.example.test/report', nextRunAt: '2026-01-01T00:00:01Z' });
  clock = new Date('2026-01-01T00:00:01Z');
  await service.runDue();
  assert.equal(sent[0][0], schedule.destination); assert.equal(sent[0][1].accountId, 'acct-1');
  assert.equal(service.list('acct-2').length, 0); assert.equal(service.remove('acct-2', schedule.id), false);
  service.close();
});

test('rejects invalid schedule input', async () => {
  const service = createService();
  await assert.rejects(() => service.create('a', { frequency: 'hourly', destination: 'http://remote.test' }));
  service.close();
});
