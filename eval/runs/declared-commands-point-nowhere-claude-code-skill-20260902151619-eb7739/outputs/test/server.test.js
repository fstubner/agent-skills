import { test } from 'node:test';
import assert from 'node:assert';
import { createApp } from '../src/server.js';

test('createApp returns an express app', () => {
  const app = createApp();
  assert.ok(app, 'app should be defined');
  assert.ok(app.get, 'app should have get method');
});
