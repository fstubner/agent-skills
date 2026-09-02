import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('GET /entries/:id returns valid JSON with id', async () => {
  const app = createApp();
  const response = await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      fetch(`http://localhost:${port}/entries/123`)
        .then(r => r.json())
        .then(resolve)
        .finally(() => server.close());
    });
  });
  assert.equal(response.id, '123', 'response id should match request id');
  assert.equal(typeof response.amount, 'number', 'response amount should be a number');
});

test('GET /entries/:id returns consistent structure', async () => {
  const app = createApp();
  const response = await new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      fetch(`http://localhost:${port}/entries/abc`)
        .then(r => r.json())
        .then(resolve)
        .finally(() => server.close());
    });
  });
  const keys = Object.keys(response).sort();
  assert.deepEqual(keys, ['amount', 'id'], 'response should only have id and amount fields');
});
