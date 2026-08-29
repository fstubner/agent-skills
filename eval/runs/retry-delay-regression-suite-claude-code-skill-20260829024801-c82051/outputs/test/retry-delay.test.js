import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});
