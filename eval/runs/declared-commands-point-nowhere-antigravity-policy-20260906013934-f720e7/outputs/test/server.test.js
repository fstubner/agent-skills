import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { createApp } = await import('../src/server.js');

test('GET /entries/:id returns entry object with amount 0', async (t) => {
  const app = createApp();
  const server = app.listen(0);
  t.after(() => server.close());

  const address = server.address();
  const port = address.port;

  const res = await fetch(`http://127.0.0.1:${port}/entries/42`);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.deepEqual(data, { id: '42', amount: 0 });
});

test('GET unknown endpoint returns 404', async (t) => {
  const app = createApp();
  const server = app.listen(0);
  t.after(() => server.close());

  const address = server.address();
  const port = address.port;

  const res = await fetch(`http://127.0.0.1:${port}/unknown`);
  assert.equal(res.status, 404);
});
