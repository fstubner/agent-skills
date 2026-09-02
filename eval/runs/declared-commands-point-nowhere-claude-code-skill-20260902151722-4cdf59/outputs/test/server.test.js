import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp returns an express app', () => {
  const app = createApp();
  assert(app, 'app should be defined');
  assert(typeof app === 'object', 'app should be an object');
});

test('app has expected route', async () => {
  const app = createApp();
  assert(app._router, 'app should have a router');
});
