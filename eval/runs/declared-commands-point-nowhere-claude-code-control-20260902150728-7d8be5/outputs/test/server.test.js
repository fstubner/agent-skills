import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp returns an Express app', () => {
  const app = createApp();
  assert(app);
  assert(typeof app.listen === 'function');
});
