import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp exports a function', () => {
  assert(typeof createApp === 'function');
});

test('createApp returns an express app', () => {
  const app = createApp();
  assert(app);
  assert(typeof app.listen === 'function');
  assert(typeof app.get === 'function');
});

test('app has /entries/:id route', () => {
  const app = createApp();
  assert(app._router);
  const routes = app._router.stack.filter(r => r.route);
  const entriesRoute = routes.find(r => r.route.path === '/entries/:id');
  assert(entriesRoute, 'Should have /entries/:id route');
});
