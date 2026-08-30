import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function running() { const server = createServer({ origin: 'http://test' }); await new Promise(r => server.listen(0, r)); return { server, url: `http://localhost:${server.address().port}` }; }

test('creates an invite and returns the original on retry', async t => {
  const { server, url } = await running(); t.after(() => server.close());
  const headers = { Authorization: 'Bearer alice', 'Idempotency-Key': 'abc', 'Content-Type': 'application/json' };
  const first = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers, body: JSON.stringify({ email: 'person@example.com', role: 'editor' }) });
  const original = await first.json(); assert.equal(first.status, 201); assert.equal(original.invitedBy, 'alice');
  const second = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers, body: JSON.stringify({ email: 'other@example.com', role: 'viewer' }) });
  assert.equal(second.status, 200); assert.deepEqual(await second.json(), original);
});

test('rejects missing auth and invalid input', async t => {
  const { server, url } = await running(); t.after(() => server.close());
  let response = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST' }); assert.equal(response.status, 401);
  response = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers: { Authorization: 'Bearer a', 'Idempotency-Key': 'x', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bad', role: 'owner' }) }); assert.equal(response.status, 400); assert.equal((await response.json()).code, 'invalid_email');
});
