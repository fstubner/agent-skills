import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { once } from 'node:events';

async function request(server, id, account, amountCents, key) {
  const address = server.address();
  return fetch(`http://127.0.0.1:${address.port}/payments/${id}/refunds`, {
    method: 'POST', headers: { authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ amountCents })
  });
}

test('refunds are authorized, capped, and idempotent', async (t) => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } }).listen(0);
  await once(server, 'listening');
  t.after(() => server.close());
  let response = await request(server, 'p1', 'acct-1', 600, 'k1');
  assert.equal(response.status, 201);
  const first = await response.json();
  response = await request(server, 'p1', 'acct-1', 600, 'k1');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), first);
  assert.equal((await request(server, 'p1', 'acct-1', 401, 'k2')).status, 409);
  assert.equal((await request(server, 'p1', 'acct-2', 1, 'secret')).status, 404);
  assert.equal((await request(server, 'missing', 'acct-2', 1, 'x')).status, 404);
});
