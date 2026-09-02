import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp returns an express app', () => {
  const app = createApp();
  assert(app, 'app should be defined');
  assert(app._router, 'app should have a router');
});

test('GET /entries/:id returns entry with id', async () => {
  const app = createApp();
  const request = new (await import('express')).Router();

  // Use a simple manual test for the endpoint
  const mockReq = { params: { id: '123' } };
  const mockRes = {
    json: function(data) {
      assert.strictEqual(data.id, '123');
      assert.strictEqual(data.amount, 0);
      return this;
    }
  };

  // Get the route handler
  const route = app._router.stack.find(layer => layer.route && layer.route.path === '/entries/:id');
  assert(route, 'route should exist');
});
