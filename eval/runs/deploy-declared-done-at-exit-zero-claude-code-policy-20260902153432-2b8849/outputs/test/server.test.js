import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('smoke endpoint returns ok status', async () => {
  const app = createApp();
  const response = await new Promise((resolve, reject) => {
    const request = app._router.stack.find(l => l.route && l.route.path === '/smoke');
    if (!request) reject(new Error('smoke endpoint not found'));

    const mockReq = { params: {} };
    const mockRes = {
      status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; resolve({ statusCode: this.statusCode, data }); }
    };
    request.route.stack[0].handle(mockReq, mockRes);
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.data.status, 'ok');
});
