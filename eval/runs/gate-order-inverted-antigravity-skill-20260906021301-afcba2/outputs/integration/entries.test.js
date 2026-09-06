import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';

test('an entry round-trips through a listening server', async () => {
  const server = createApp().listen(0);
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/entries/abc`);
  assert.equal((await res.json()).id, 'abc');
  server.close();
});
