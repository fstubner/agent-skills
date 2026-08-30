import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('backs off at the first attempt and caps exponential growth', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 8, status: 599 }), 30_000);
  assert.equal(retryDelay({ attempt: 100, status: 500 }), 30_000);
});

test('backs off for both server-error boundaries', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
});

test('uses a valid 429 retry-after value, including zero', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 1_250 }), 1_250);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 0 }), 0);
});

test('caps a valid 429 retry-after value at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid 429 retry-after values', () => {
  const invalidValues = [undefined, null, -1, Infinity, NaN, '1000'];

  for (const retryAfterMs of invalidValues) {
    assert.equal(
      retryDelay({ attempt: 2, status: 429, retryAfterMs }),
      500,
      `retryAfterMs=${String(retryAfterMs)}`,
    );
  }
});

test('does not retry non-retryable statuses', () => {
  for (const status of [199, 200, 428, 499, 499.9, 600, 599.1, undefined]) {
    assert.equal(retryDelay({ attempt: 1, status }), null, `status=${String(status)}`);
  }
});

test('retries statuses numerically inside the 5xx range', () => {
  assert.equal(retryDelay({ attempt: 1, status: 503.5 }), 250);
});

test('rejects attempts that are not positive integers', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1', null, undefined]) {
    assert.throws(
      () => retryDelay({ attempt, status: 500 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
      `attempt=${String(attempt)}`,
    );
  }
});
