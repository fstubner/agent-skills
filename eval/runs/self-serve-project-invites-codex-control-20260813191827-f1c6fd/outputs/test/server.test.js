import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function runningServer() {
  const server = createServer({ baseUrl: 'https://example.test', projectAdmins: { p1: ['alice'] } });
  await new Promise(resolve => server.listen(0, resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('admin creates an invite and an identical retry returns the original invite', async t => {
  const { server, url } = await runningServer(); t.after(() => server.close());
  const headers = { authorization: 'Bearer alice', 'content-type': 'application/json', 'idempotency-key': 'key-1' };
  const first = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers, body: JSON.stringify({ email: ' Person@Example.com ', role: 'viewer' }) });
  const firstBody = await first.json();
  assert.equal(first.status, 201); assert.equal(firstBody.email, 'person@example.com'); assert.match(firstBody.inviteUrl, /^https:\/\/example\.test\/invite\//);
  const retry = await fetch(`${url}/api/projects/p1/invites`, { method: 'POST', headers, body: JSON.stringify({ email: 'other@example.com', role: 'editor' }) });
  assert.deepEqual(await retry.json(), firstBody);
});

test('authentication, admin authorization, and input validation are enforced', async t => {
  const { server, url } = await runningServer(); t.after(() => server.close());
  const post = (headers, payload) => fetch(`${url}/api/projects/p1/invites`, { method:'POST', headers, body:JSON.stringify(payload) });
  assert.equal((await post({ 'idempotency-key':'a' }, { email:'a@b.com', role:'viewer' })).status, 401);
  assert.equal((await post({ authorization:'Bearer bob', 'idempotency-key':'b' }, { email:'a@b.com', role:'viewer' })).status, 403);
  assert.equal((await post({ authorization:'Bearer alice', 'idempotency-key':'c' }, { email:'bad', role:'owner' })).status, 422);
});

test('browser page is served', async t => {
  const { server, url } = await runningServer(); t.after(() => server.close());
  const response = await fetch(url); const html = await response.text();
  assert.equal(response.status, 200); assert.match(html, /Invite someone to a project/); assert.match(html, /aria-live/);
});
