import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { once } from 'node:events';

test('admin creates and retries an invite idempotently', async t => {
  const server = createServer().listen(0); await once(server, 'listening'); t.after(() => server.close());
  const url = `http://localhost:${server.address().port}/api/projects/demo/invites`;
  const headers = { Authorization: 'Bearer admin@example.com', 'Content-Type': 'application/json', 'Idempotency-Key': 'abc' };
  const first = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ email: 'Person@Example.com', role: 'viewer' }) });
  const a = await first.json(); assert.equal(first.status, 201); assert.equal(a.email, 'person@example.com');
  const second = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ email: 'other@example.com', role: 'editor' }) });
  assert.deepEqual(await second.json(), a);
});

test('rejects unauthenticated and non-admin requests', async t => {
  const server = createServer().listen(0); await once(server, 'listening'); t.after(() => server.close());
  const url = `http://localhost:${server.address().port}/api/projects/demo/invites`;
  let r = await fetch(url, { method: 'POST' }); assert.equal(r.status, 401);
  r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer stranger', 'Idempotency-Key': 'x' }, body: '{}' }); assert.equal(r.status, 403);
});
