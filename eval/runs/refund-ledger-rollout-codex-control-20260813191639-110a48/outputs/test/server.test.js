import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../src/server.js';

async function request(server, path, { account = 'acct-1', key = 'key-1', amountCents = 1 } = {}) {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: address.address, port: address.port, path, method: 'POST', headers: {
      authorization: `Bearer ${account}`, 'idempotency-key': key, 'content-type': 'application/json'
    }}, res => { let body = ''; res.on('data', c => body += c); res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: JSON.parse(body) }); }); });
    req.on('error', reject); req.end(JSON.stringify({ amountCents }));
  });
}

test('creates a refund and retries return the original refund', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } });
  const first = await request(server, '/payments/p1/refunds', { amountCents: 600 });
  const retry = await request(server, '/payments/p1/refunds', { amountCents: 600 });
  assert.equal(first.status, 201);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body, first.body);
});

test('rejects over-refunds and does not disclose another account payment', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } });
  assert.equal((await request(server, '/payments/p1/refunds', { amountCents: 1001 })).status, 422);
  assert.deepEqual((await request(server, '/payments/p1/refunds', { account: 'acct-2' })).body,
    (await request(server, '/payments/nope/refunds', { account: 'acct-2', key: 'key-2' })).body);
});

test('validates authentication, idempotency, and integer amount', async () => {
  const server = createServer({ payments: { id: 'p1', owner: 'acct-1', amountCents: 1000 } });
  const result = await request(server, '/payments/p1/refunds', { amountCents: 1.5 });
  assert.equal(result.status, 400);
});
