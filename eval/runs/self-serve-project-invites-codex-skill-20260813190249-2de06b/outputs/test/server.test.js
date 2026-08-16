import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withServer(fn) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  try { await fn(`http://127.0.0.1:${port}`); } finally { await new Promise(resolve => server.close(resolve)); }
}

test('creates an invite and repeats the original for the same idempotency key', async () => withServer(async base => {
  const headers = { Authorization: 'Bearer acme-admin', 'Content-Type': 'application/json', 'Idempotency-Key': 'request-1' };
  const first = await fetch(`${base}/api/projects/roadmap/invites`, { method: 'POST', headers, body: JSON.stringify({ email: 'Person@Example.com', role: 'editor' }) });
  const one = await first.json();
  assert.equal(first.status, 201); assert.equal(one.email, 'person@example.com'); assert.equal(one.role, 'editor'); assert.equal(one.inviter, 'acme-admin');
  const second = await fetch(`${base}/api/projects/roadmap/invites`, { method: 'POST', headers, body: JSON.stringify({ email: 'changed@example.com', role: 'viewer' }) });
  assert.deepEqual(await second.json(), one);
}));

test('rejects missing auth and invalid role with structured errors', async () => withServer(async base => {
  let response = await fetch(`${base}/api/projects/p/invites`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'x' }, body: '{}' });
  assert.equal(response.status, 401); assert.equal((await response.json()).code, 'unauthorized');
  response = await fetch(`${base}/api/projects/p/invites`, { method: 'POST', headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json', 'Idempotency-Key': 'y' }, body: JSON.stringify({ email: 'a@example.com', role: 'owner' }) });
  assert.equal(response.status, 422); assert.equal((await response.json()).code, 'invalid_role');
}));
