import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function running(options) { const server = createServer(options); await new Promise(r => server.listen(0, r)); return { server, url: `http://127.0.0.1:${server.address().port}` }; }

test('admin creates an invite and same key returns the original invite', async t => {
  const { server, url } = await running({ projectAdmins: { p1: ['alice'] }, baseUrl: urlPlaceholder() });
  t.after(() => server.close());
  const headers = { Authorization: 'Bearer alice', 'Content-Type': 'application/json', 'Idempotency-Key': 'k1' };
  const first = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers, body: JSON.stringify({ email: 'Person@Example.com', role: 'viewer' }) });
  const a = await first.json();
  const second = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers, body: JSON.stringify({ email: 'changed@example.com', role: 'editor' }) });
  assert.equal(first.status, 201); assert.deepEqual(await second.json(), a); assert.equal(a.email, 'person@example.com');
});

test('rejects missing auth, non-admin, and invalid role', async t => {
  const { server, url } = await running({ projectAdmins: { p1: ['alice'] } }); t.after(() => server.close());
  let r = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST' }); assert.equal(r.status, 401);
  r = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers: { Authorization: 'Bearer bob', 'Idempotency-Key': 'x' }, body: '{}' }); assert.equal(r.status, 403);
  r = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers: { Authorization: 'Bearer alice', 'Idempotency-Key': 'x' }, body: JSON.stringify({ email: 'a@b.com', role: 'owner' }) }); assert.equal(r.status, 400);
});

function urlPlaceholder() { return 'http://localhost:3000'; }
