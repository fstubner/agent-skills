import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function request(server, id, account, amount, key) {
  const address = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address())));
  const response = await fetch(`http://${address.address}:${address.port}/payments/${id}/refunds`, {
    method: 'POST', headers: { Authorization: `Bearer ${account}`, 'Idempotency-Key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents: amount })
  });
  const json = await response.json(); server.close();
  return { status: response.status, json };
}

test('creates a refund and retries the original refund', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } });
  const first = await request(server, 'p1', 'acct-1', 400, 'k1');
  const retry = await request(server, 'p1', 'acct-1', 400, 'k1');
  assert.equal(first.status, 201); assert.deepEqual(retry, { status: 200, json: first.json });
});

test('enforces ownership, integer amounts, and remaining balance', async () => {
  const server = createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 1000 }] });
  assert.equal((await request(server, 'p1', 'acct-2', 1, 'x')).status, 404);
  assert.equal((await request(server, 'missing', 'acct-1', 1, 'x')).status, 404);
  assert.equal((await request(server, 'p1', 'acct-1', 1.5, 'x')).status, 400);
  assert.equal((await request(server, 'p1', 'acct-1', 1001, 'x')).status, 409);
});
