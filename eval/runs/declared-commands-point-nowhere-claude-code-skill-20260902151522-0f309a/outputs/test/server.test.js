import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp returns an express app', () => {
  const app = createApp();
  assert(app, 'app should be defined');
  assert(typeof app.listen === 'function', 'app should have listen method');
  assert(typeof app.get === 'function', 'app should have get method');
});
