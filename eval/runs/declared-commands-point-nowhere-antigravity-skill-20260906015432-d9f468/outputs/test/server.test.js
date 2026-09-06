import test from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('GET /entries/:id returns entry object', async () => {
  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  try {
    const res = await fetch(`http://localhost:${port}/entries/123`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body, { id: '123', amount: 0 });
  } finally {
    server.close();
  }
});
