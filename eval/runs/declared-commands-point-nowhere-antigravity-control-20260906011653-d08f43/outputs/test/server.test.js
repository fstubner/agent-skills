import test from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

process.env.NODE_ENV = 'test';

test('GET /entries/:id returns entry details', async () => {
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  try {
    const res = await fetch(`http://localhost:${port}/entries/123`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { id: '123', amount: 0 });
  } finally {
    server.close();
  }
});
