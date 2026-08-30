import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('reads an existing account', async () => {
  const app = createApp({ accounts: [{ id: 'a1', name: 'Ada' }], auditEvents: [] });
  const response = await app.request('GET', '/accounts/a1');
  assert.equal(response.status, 200);
  assert.equal(response.body.state, 'active');
});

test('suspends an account, persists the state, and appends an audit event', async () => {
  const accounts = [{ id: 'a1', name: 'Ada' }];
  const auditEvents = [];
  const app = createApp({ accounts, auditEvents });

  const response = await app.request('POST', '/accounts/a1/suspend');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { id: 'a1', name: 'Ada', state: 'suspended' });
  assert.equal(accounts[0].state, 'suspended');
  assert.deepEqual(auditEvents, [{ type: 'account.suspended', accountId: 'a1' }]);
});

test('returns 404 when suspending an unknown account', async () => {
  const auditEvents = [];
  const app = createApp({ accounts: [], auditEvents });

  const response = await app.request('POST', '/accounts/missing/suspend');

  assert.equal(response.status, 404);
  assert.equal(response.body, null);
  assert.deepEqual(auditEvents, []);
});
