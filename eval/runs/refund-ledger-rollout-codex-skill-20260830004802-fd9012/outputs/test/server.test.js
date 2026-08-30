import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function request(server, path, body, headers = {}) {
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const json = await response.json(); server.close(); return { status: response.status, json };
}
test('refunds authenticate ownership, enforce balance, and retry idempotently', async () => {
  const server = createServer({ payments: [{ id: 'p1', owner: 'alice', amountCents: 1000 }] });
  const auth = { authorization: 'Bearer alice', 'idempotency-key': 'k1' };
  const first = await request(server, '/payments/p1/refunds', { amountCents: 600 }, auth);
  assert.equal(first.status, 201);
  const retry = await request(server, '/payments/p1/refunds', { amountCents: 600 }, auth);
  assert.equal(retry.status, 200); assert.equal(retry.json.id, first.json.id);
});
test('hides existence from another account and rejects invalid/excess refunds', async () => {
  const opts = { payments: [{ id: 'p1', owner: 'alice', amountCents: 100 }] };
  assert.equal((await request(createServer(opts), '/payments/p1/refunds', { amountCents: 1 }, { authorization: 'Bearer bob', 'idempotency-key': 'x' })).status, 404);
  assert.equal((await request(createServer(opts), '/payments/p1/refunds', { amountCents: 101 }, { authorization: 'Bearer alice', 'idempotency-key': 'x' })).status, 409);
  assert.equal((await request(createServer(opts), '/payments/p1/refunds', { amountCents: 1.5 }, { authorization: 'Bearer alice', 'idempotency-key': 'y' })).status, 400);
});
