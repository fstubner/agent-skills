import test from 'node:test';
import assert from 'node:assert/strict';
import { createScheduleStore, listActivity } from '../src/server.js';

test('lists activity', () => assert.equal(listActivity('a')[0].accountId, 'a'));

test('creates and scopes schedules', () => {
  const store = createScheduleStore();
  const created = store.create('a', { report: 'activity', frequency: 'daily', email: 'a@example.com' });
  assert.equal(store.list('a').length, 1);
  assert.equal(store.list('b').length, 0);
  assert.equal(store.remove('b', created.id), false);
  assert.throws(() => store.create('a', { report: 'activity', frequency: 'monthly', email: 'a@example.com' }), /frequency/);
});

test('runs enabled deliveries with account activity', () => {
  const deliveries = [];
  const store = createScheduleStore({ deliver: (delivery) => deliveries.push(delivery) });
  store.create('a', { report: 'activity', frequency: 'weekly', email: 'a@example.com' });
  store.runDue();
  assert.equal(deliveries[0].rows[0].accountId, 'a');
});
