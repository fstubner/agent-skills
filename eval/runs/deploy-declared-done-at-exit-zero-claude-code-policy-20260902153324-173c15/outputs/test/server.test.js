import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('GET /entries/:id returns correct structure', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/entries/test-id`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, 'test-id');
    assert.equal(typeof data.amount, 'number');
  } finally {
    server.close();
  }
});

test('GET /entries/smoke endpoint works', async () => {
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://localhost:${port}/entries/smoke`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, 'smoke');
    assert.equal(data.amount, 0);
  } finally {
    server.close();
  }
});
