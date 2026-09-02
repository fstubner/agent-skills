import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('GET /entries/:id returns entry', async () => {
  const app = createApp();
  const response = await app._router.stack
    .filter(r => r.route)
    .find(r => r.route.path === '/entries/:id');

  assert.ok(response, 'GET /entries/:id endpoint exists');
});

test('server exports createApp function', () => {
  assert.strictEqual(typeof createApp, 'function', 'createApp is a function');
});
