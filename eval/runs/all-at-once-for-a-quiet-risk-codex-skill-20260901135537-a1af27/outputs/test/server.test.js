import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('healthz reports readiness', async () => {
  const server = createApp().listen(0);
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
  server.close();
});
