import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/server.js';

async function request(server, { account = 'acct-1', key = 'k1', amountCents = 100, id = 'p1', body = true, close = true } = {}) {
  if (!server.listening) await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  return new Promise((resolve, reject) => {
    const req = http.request({ port, path: `/payments/${id}/refunds`, method: 'POST', headers: { authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json' } }, (res) => {
      let data = ''; res.on('data', (chunk) => { data += chunk; }); res.on('end', () => { if (close) server.close(); resolve({ status: res.statusCode, body: JSON.parse(data) }); });
    });
    req.on('error', reject); if (body) req.end(JSON.stringify({ amountCents })); else req.end('{}');
  });
}

test('creates a refund and returns the original refund on retry', async () => {
  const server = createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 500 }] });
  const first = await request(server, { amountCents: 200, close: false });
  const retry = await request(server, { amountCents: 400 });
  assert.equal(first.status, 201);
  assert.deepEqual(retry.body.amountCents, first.body.amountCents);
  assert.equal(retry.body.id, first.body.id);
});

test('enforces ownership without revealing whether payment exists', async () => {
  const options = { payments: [{ id: 'p1', owner: 'acct-1', amountCents: 500 }] };
  const wrongOwner = await request(createServer(options), { account: 'acct-2' });
  const missing = await request(createServer(options), { id: 'missing' });
  assert.equal(wrongOwner.status, 404); assert.deepEqual(wrongOwner.body, missing.body);
});

test('rejects invalid amounts and over-refunds', async () => {
  let result = await request(createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 100 }] }), { amountCents: 101 });
  assert.equal(result.status, 409);
  result = await request(createServer({ payments: [{ id: 'p1', owner: 'acct-1', amountCents: 100 }] }), { amountCents: 1.5 });
  assert.equal(result.status, 400);
});
