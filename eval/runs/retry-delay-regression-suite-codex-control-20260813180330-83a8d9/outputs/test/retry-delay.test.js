import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors exponentially from 250ms', () => {
  assert.deepEqual(
    [1, 2, 3, 4].map((attempt) => retryDelay({ attempt, status: 503 })),
    [250, 500, 1000, 2000],
  );
});

test('caps server-error backoff at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30_000);
  assert.equal(retryDelay({ attempt: 100, status: 599 }), 30_000);
});

test('uses retry-after for rate limits, including zero', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 1_250 }), 1_250);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 0 }), 0);
});

test('caps a valid rate-limit retry-after value', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid rate-limit retry-after values', () => {
  for (const retryAfterMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, '1000', null]) {
    assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs }), 1_000);
  }
});

test('does not retry non-retryable statuses', () => {
  for (const status of [200, 400, 404, 499, 600]) {
    assert.equal(retryDelay({ attempt: 1, status }), null);
  }
});

test('requires a positive integer attempt', () => {
  for (const attempt of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null]) {
    assert.throws(
      () => retryDelay({ attempt, status: 503 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
