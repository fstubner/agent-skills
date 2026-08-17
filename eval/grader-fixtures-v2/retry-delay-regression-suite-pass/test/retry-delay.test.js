import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('observes retry behavior at the public boundary', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 80_000 }), 30_000);
  assert.throws(() => retryDelay({ attempt: 0, status: 503 }), /positive integer/);
});
