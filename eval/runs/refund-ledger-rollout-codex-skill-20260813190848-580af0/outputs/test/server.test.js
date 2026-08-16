import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function running(payments = [{ id: 'p1', owner: 'acct-1', amountCents: 1000 }]) {
  const server = createServer({ payments });
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function refund(url, account, key, amountCents) {
  return fetch(`${url}/payments/p1/refunds`, {
    method: 'POST',
    headers: { authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents }),
  });
}

test('creates a refund and retries return the original refund', async (t) => {
  const app = await running();
  t.after(() => app.server.close());
  const first = await refund(app.url, 'acct-1', 'k1', 400);
  const original = await first.json();
  const retry = await refund(app.url, 'acct-1', 'k1', 999);
  assert.equal(retry.status, 201);
  assert.deepEqual(await retry.json(), original);
  assert.equal((await refund(app.url, 'acct-1', 'k2', 601)).status, 409);
});

test('rejects invalid amounts and hides another account payment existence', async (t) => {
  const app = await running();
  t.after(() => app.server.close());
  assert.equal((await refund(app.url, 'acct-1', 'bad', 0)).status, 400);
  const response = await refund(app.url, 'acct-2', 'secret', 1);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { code: 'payment_not_found', message: 'Payment not found' });
});

test('requires bearer authentication and idempotency key', async (t) => {
  const app = await running();
  t.after(() => app.server.close());
  const unauthenticated = await fetch(`${app.url}/payments/p1/refunds`, { method: 'POST' });
  assert.equal(unauthenticated.status, 401);
  const missingKey = await fetch(`${app.url}/payments/p1/refunds`, {
    method: 'POST', headers: { authorization: 'Bearer acct-1', 'content-type': 'application/json' }, body: '{"amountCents":1}',
  });
  assert.equal(missingKey.status, 400);
});
