import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors exponentially', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 599 }), 1_000);
});

test('caps server-error backoff at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30_000);
  assert.equal(retryDelay({ attempt: 20, status: 500 }), 30_000);
});

test('uses retry-after for rate limits when it is valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1_250 }), 1_250);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 30_000 }), 30_000);
});

test('caps an oversized retry-after value', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid retry-after values', () => {
  for (const retryAfterMs of [-1, NaN, Infinity, '1000', null, undefined]) {
    assert.equal(
      retryDelay({ attempt: 3, status: 429, retryAfterMs }),
      1_000,
      `retryAfterMs=${String(retryAfterMs)}`,
    );
  }
});

test('does not retry statuses outside rate limits and server errors', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('requires a positive integer attempt', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1', null, undefined]) {
    assert.throws(
      () => retryDelay({ attempt, status: 500 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
