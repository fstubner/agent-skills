process.env.NODE_ENV = 'test';

import test from 'node:test';
import assert from 'node:assert';

const { createApp } = await import('../src/server.js');
const { createApp: indexCreateApp } = await import('../src/index.js');

test('createApp is exported correctly', () => {
  assert.strictEqual(typeof createApp, 'function');
  assert.strictEqual(typeof indexCreateApp, 'function');
});

test('GET /entries/:id returns entry details', async (t) => {
  const app = createApp();
  const server = app.listen(0);
  t.after(() => server.close());

  const address = server.address();
  const port = typeof address === 'string' ? address : address.port;
  const res = await fetch(`http://localhost:${port}/entries/123`);

  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.deepStrictEqual(data, { id: '123', amount: 0 });
});
