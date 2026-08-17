import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function request(server, path, { account = 'acct-1', key = 'k-1', amountCents = 100 } = {}) {
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents })
  });
  const json = await response.json(); server.close();
  return { status: response.status, json };
}

test('refunds authenticate, cap the total, and are idempotent', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 100 } });
  assert.equal((await request(server, '/payments/p1/refunds', { amountCents: 60 })).status, 201);
  const retry = await request(server, '/payments/p1/refunds', { amountCents: 60 });
  assert.deepEqual(retry, { status: 201, json: { paymentId: 'p1', amountCents: 60 } });
  assert.equal((await request(server, '/payments/p1/refunds', { key: 'k-2', amountCents: 50 })).status, 409);
});

test('foreign accounts receive no payment existence signal', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 100 } });
  assert.equal((await request(server, '/payments/p1/refunds', { account: 'acct-2' })).status, 404);
  assert.equal((await request(server, '/payments/missing/refunds')).status, 404);
});
