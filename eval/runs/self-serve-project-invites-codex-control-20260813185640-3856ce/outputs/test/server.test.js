import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function runningServer(options) {
  const server = createServer(options);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('admin creates an invite and idempotent retry returns the same invite', async t => {
  const { server, url } = await runningServer({ projectAdmins: { alpha: ['alice'] }, baseUrl: 'https://app.test' });
  t.after(() => server.close());
  const headers = { Authorization: 'Bearer alice', 'Content-Type': 'application/json', 'Idempotency-Key': 'k-1' };
  const body = JSON.stringify({ email: ' Person@Example.com ', role: 'viewer' });
  const first = await fetch(`${url}/api/projects/alpha/invites`, { method: 'POST', headers, body });
  const invite = await first.json();
  assert.equal(first.status, 201);
  assert.deepEqual(invite, { projectId: 'alpha', email: 'person@example.com', role: 'viewer', invitedBy: 'alice', inviteUrl: invite.inviteUrl });
  assert.match(invite.inviteUrl, /^https:\/\/app\.test\/invite\//);
  const retry = await fetch(`${url}/api/projects/alpha/invites`, { method: 'POST', headers, body });
  assert.equal(retry.status, 201);
  assert.deepEqual(await retry.json(), invite);
});

test('authentication, authorization, and input rules are enforced', async t => {
  const { server, url } = await runningServer({ projectAdmins: { alpha: ['alice'] } });
  t.after(() => server.close());
  const post = (headers, data) => fetch(`${url}/api/projects/alpha/invites`, { method: 'POST', headers, body: JSON.stringify(data) });
  assert.equal((await post({ 'Idempotency-Key': 'a' }, { email: 'a@b.com', role: 'viewer' })).status, 401);
  assert.equal((await post({ Authorization: 'Bearer bob', 'Idempotency-Key': 'b' }, { email: 'a@b.com', role: 'viewer' })).status, 403);
  assert.equal((await post({ Authorization: 'Bearer alice', 'Idempotency-Key': 'c' }, { email: 'bad', role: 'owner' })).status, 400);
});

test('browser form is served', async t => {
  const { server, url } = await runningServer();
  t.after(() => server.close());
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Create invite link/);
});
