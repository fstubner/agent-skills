import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('an entry is served with the id it was asked for', async () => {
  const server = createApp().listen(0);
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/entries/abc`);
  assert.equal((await res.json()).id, 'abc');
  server.close();
});
