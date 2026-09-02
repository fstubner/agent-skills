import assert from 'node:assert/strict';
import test from 'node:test';
import { config } from '../src/config.js';

test('config exposes a bucket', () => {
  assert.equal(typeof config.bucket, 'string');
});
