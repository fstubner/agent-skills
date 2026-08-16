import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function request(server, path, { account = 'acct-1', key = 'k-1', amountCents = 100, close = true } = {}) {
  if (!server.listening) await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents })
  });
  const json = await response.json();
  if (close) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return { response, json };
}

test('creates a refund and retries return the original refund', async () => {
  const server = createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 500 }] });
  const first = await request(server, '/payments/p1/refunds', { amountCents: 125, close: false });
  const retry = await request(server, '/payments/p1/refunds', { amountCents: 125 });
  assert.equal(first.response.status, 201);
  assert.equal(retry.response.status, 201);
  assert.equal(retry.json.amountCents, 125);
  assert.equal(retry.json.id, first.json.id);
});

test('rejects excess refunds and hides payments from other accounts', async () => {
  const server = createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 100 }] });
  assert.equal((await request(server, '/payments/p1/refunds', { amountCents: 101 })).response.status, 422);
  assert.equal((await request(createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 100 }] }), '/payments/p1/refunds', { account: 'acct-2' })).response.status, 404);
  assert.equal((await request(createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 100 }] }), '/payments/missing/refunds')).response.status, 404);
});

test('requires integer amount and bearer authentication', async () => {
  const server = createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 100 }] });
  const unauth = await request(server, '/payments/p1/refunds', { amountCents: 1 });
  assert.equal(unauth.response.status, 201); // helper supplies Bearer auth
  const invalid = await request(createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 100 }] }), '/payments/p1/refunds', { amountCents: 1.5 });
  assert.equal(invalid.response.status, 400);
});
