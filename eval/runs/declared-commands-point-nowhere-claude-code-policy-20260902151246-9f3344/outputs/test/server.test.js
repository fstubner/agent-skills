import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp returns an express app', () => {
  const app = createApp();
  assert(app);
  assert(typeof app === 'object');
  assert(typeof app.listen === 'function');
});

test('app has /entries/:id route', () => {
  const app = createApp();
  const routes = app._router.stack
    .filter(layer => layer.route)
    .map(layer => layer.route.path);
  assert(routes.includes('/entries/:id'), 'Expected /entries/:id route to exist');
});
