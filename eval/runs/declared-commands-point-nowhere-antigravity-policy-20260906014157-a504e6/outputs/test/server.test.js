process.env.NODE_ENV = 'test';

import { test } from 'node:test';
import assert from 'node:assert';

const { createApp: createAppServer } = await import('../src/server.js');
const { createApp: createAppIndex } = await import('../src/index.js');

test('createApp from src/server.js handles GET /entries/:id', async () => {
  const app = createAppServer();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/entries/456`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, { id: '456', amount: 0 });
  } finally {
    server.close();
  }
});

test('createApp re-exported from src/index.js works', async () => {
  const app = createAppIndex();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/entries/789`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, { id: '789', amount: 0 });
  } finally {
    server.close();
  }
});

test('GET non-existent route returns 404', async () => {
  const app = createAppServer();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/unknown-route`);
    assert.strictEqual(res.status, 404);
  } finally {
    server.close();
  }
});
