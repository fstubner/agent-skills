import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, listActivity, resetStore, runDueSchedules } from '../src/server.js';

let app, base;
beforeEach(async () => { resetStore(); app = createApp(); await new Promise(r => app.listen(0, r)); base = `http://127.0.0.1:${app.address().port}`; });
afterEach(async () => { if (app) await new Promise(r => app.close(r)); });
const options = (method, body, account = 'acct_1') => ({ method, headers: { 'x-account-id': account, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });

test('lists activity', () => assert.equal(listActivity('a')[0].accountId, 'a'));
test('creates and scopes schedules to the account', async () => {
  let response = await fetch(`${base}/api/schedules`, options('POST', { email: 'owner@example.com', frequency: 'daily', time: '09:30' }));
  assert.equal(response.status, 201); const schedule = await response.json(); assert.equal(schedule.accountId, 'acct_1');
  response = await fetch(`${base}/api/schedules`, { headers: { 'x-account-id': 'other' } }); assert.deepEqual(await response.json(), []);
  response = await fetch(`${base}/api/schedules/${schedule.id}`, options('PATCH', { enabled: false }, 'other')); assert.equal(response.status, 404);
});
test('rejects invalid schedules and requires account identity', async () => {
  let response = await fetch(`${base}/api/schedules`, options('POST', { email: 'bad', frequency: 'hourly', time: '99:99' }));
  assert.equal(response.status, 400);
  response = await fetch(`${base}/api/schedules`); assert.equal(response.status, 401);
});
test('delivers a due schedule once per period', async () => {
  const sent = []; const response = await fetch(`${base}/api/schedules`, options('POST', { email: 'owner@example.com', frequency: 'daily', time: '09:30' })); assert.equal(response.status, 201);
  const now = new Date('2026-08-13T09:30:00Z'); assert.equal(await runDueSchedules(now, message => sent.push(message)), 1); assert.equal(await runDueSchedules(now, message => sent.push(message)), 0); assert.equal(sent[0].to, 'owner@example.com');
});
