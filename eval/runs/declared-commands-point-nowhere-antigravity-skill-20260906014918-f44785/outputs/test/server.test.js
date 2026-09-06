import { test } from 'node:test';
import assert from 'node:assert';

test('GET /entries/:id returns entry with amount 0', async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../src/server.js');
  const app = createApp();
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/entries/456`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.deepStrictEqual(data, { id: '456', amount: 0 });
  } finally {
    server.close();
  }
});
