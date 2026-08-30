import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function request(server, path, { account = 'acct-1', key = 'key-1', body = {} } = {}) {
  const address = server.address();
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

test('refunds are owned, bounded, and idempotent', async (t) => {
  const server = createServer({ payments: { id: 'p-1', owner: 'acct-1', amountCents: 1000 } });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  let response = await request(server, '/payments/p-1/refunds', { body: { amountCents: 400 } });
  assert.equal(response.status, 201);
  const original = await response.json();
  response = await request(server, '/payments/p-1/refunds', { body: { amountCents: 999 }, key: 'key-1' });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), original);
  response = await request(server, '/payments/p-1/refunds', { body: { amountCents: 601 }, key: 'key-2' });
  assert.equal(response.status, 409);
  response = await request(server, '/payments/p-1/refunds', { account: 'acct-2', body: { amountCents: 1 } });
  assert.equal(response.status, 404);
});

test('refund boundary rejects malformed requests', async (t) => {
  const server = createServer({ payments: { id: 'p-1', owner: 'acct-1', amountCents: 1000 } });
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  let response = await request(server, '/payments/p-1/refunds', { body: { amountCents: 1.5 } });
  assert.equal(response.status, 400);
  response = await fetch(`http://127.0.0.1:${server.address().port}/payments/p-1/refunds`, { method: 'POST' });
  assert.equal(response.status, 401);
});
