import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function request(server, path, body, headers = {}, keepOpen = false) {
  if (!server.listening) await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
  });
  const result = { status: response.status, body: await response.json() };
  if (!keepOpen) await new Promise((resolve) => server.close(resolve));
  return result;
}

test('refund is authenticated, bounded, and idempotent', async () => {
  const options = { payments: [{ id: 'p1', owner: 'acct-1', amountCents: 1000 }] };
  const server = createServer(options);
  let result = await request(server, '/payments/p1/refunds', { amountCents: 400 }, { authorization: 'Bearer acct-1', 'idempotency-key': 'k1' }, true);
  assert.equal(result.status, 201);
  const first = result.body;
  result = await request(server, '/payments/p1/refunds', { amountCents: 999 }, { authorization: 'Bearer acct-1', 'idempotency-key': 'k1' });
  assert.equal(result.status, 201);
  assert.deepEqual(result.body, first);
});

test('other accounts and missing payments are indistinguishable', async () => {
  const make = () => createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 1000 }] });
  const headers = { authorization: 'Bearer acct-2', 'idempotency-key': 'k' };
  const owned = await request(make(), '/payments/p1/refunds', { amountCents: 1 }, headers);
  const absent = await request(make(), '/payments/nope/refunds', { amountCents: 1 }, headers);
  assert.deepEqual(owned, absent);
  assert.equal(owned.status, 404);
});

test('amount must be a positive integer and authentication is required', async () => {
  const server = createServer({ payments: [{ id: 'p1', owner: 'a', amountCents: 10 }] });
  assert.equal((await request(server, '/payments/p1/refunds', { amountCents: 1 }, { 'idempotency-key': 'k' })).status, 401);
  assert.equal((await request(createServer({ payments: [{ id: 'p1', owner: 'a', amountCents: 10 }] }), '/payments/p1/refunds', { amountCents: 1.2 }, { authorization: 'Bearer a', 'idempotency-key': 'k' })).status, 400);
});

test('refund cannot exceed the unrefunded balance', async () => {
  const result = await request(createServer({ payments: [{ id: 'p1', owner: 'a', amountCents: 10 }] }), '/payments/p1/refunds', { amountCents: 11 }, { authorization: 'Bearer a', 'idempotency-key': 'k' });
  assert.equal(result.status, 404);
  assert.equal(result.body.code, 'not_found');
});
