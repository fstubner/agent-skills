import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp returns an express app', () => {
  const app = createApp();
  assert(app, 'createApp should return an app');
  assert(typeof app.listen === 'function', 'app should have listen method');
});
