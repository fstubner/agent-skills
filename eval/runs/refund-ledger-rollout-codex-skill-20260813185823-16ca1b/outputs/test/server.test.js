import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function request(server, id, account, amountCents, key) {
  const address = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address())));
  const response = await fetch(`http://${address.address}:${address.port}/payments/${id}/refunds`, {
    method: 'POST', headers: { authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents })
  });
  const json = await response.json();
  await new Promise((resolve) => server.close(resolve));
  return { status: response.status, json };
}

test('creates a refund and retries return the original refund', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } });
  const first = await request(server, 'p1', 'acct-1', 400, 'k1');
  const retry = await request(server, 'p1', 'acct-1', 400, 'k1');
  assert.equal(first.status, 201); assert.deepEqual(retry, first);
});

test('rejects over-refunds and invalid amounts', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } });
  assert.equal((await request(server, 'p1', 'acct-1', 1001, 'k1')).status, 422);
  assert.equal((await request(server, 'p1', 'acct-1', 1.5, 'k2')).status, 400);
});

test('does not disclose foreign or missing payments', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } });
  const foreign = await request(server, 'p1', 'acct-2', 1, 'k1');
  const missing = await request(server, 'missing', 'acct-2', 1, 'k1');
  assert.equal(foreign.status, 404); assert.deepEqual(foreign.json, missing.json);
});
