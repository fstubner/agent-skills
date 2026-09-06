import test from 'node:test';
import assert from 'node:assert';

process.env.NODE_ENV = 'test';

const { createApp } = await import('../src/server.js');
const { createApp: createAppFromIndex } = await import('../src/index.js');

test('createApp exports from server.js and index.js', () => {
  assert.strictEqual(typeof createApp, 'function');
  assert.strictEqual(typeof createAppFromIndex, 'function');
});

test('GET /entries/:id returns entry details', async (t) => {
  const app = createApp();
  const server = app.listen(0);
  t.after(() => server.close());

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const res = await fetch(`http://127.0.0.1:${port}/entries/456`);

  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.deepStrictEqual(body, { id: '456', amount: 0 });
});
