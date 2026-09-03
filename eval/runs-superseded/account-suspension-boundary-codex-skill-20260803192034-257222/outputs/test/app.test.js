import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

test('reads an existing account', async () => {
  const app = createApp({ accounts: [{ id: 'a1', name: 'Ada' }], auditEvents: [] });
  const response = await app.request('GET', '/accounts/a1');
  assert.equal(response.status, 200);
  assert.equal(response.body.state, 'active');
});
