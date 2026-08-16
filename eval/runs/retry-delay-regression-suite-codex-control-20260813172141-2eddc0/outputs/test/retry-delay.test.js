import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('uses exponential backoff for each 5xx status at the boundaries', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 3, status: 599 }), 1_000);
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30_000);
});

test('does not retry statuses outside 5xx or 429', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
});

test('honors a valid Retry-After value for 429 responses', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 1_250 }), 1_250);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid Retry-After values', () => {
  const expected = 1_000;

  for (const retryAfterMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, '1000', undefined]) {
    assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs }), expected);
  }
});

test('rejects attempts that are not positive integers', () => {
  for (const attempt of [0, -1, 1.5, Number.NaN, '1', undefined]) {
    assert.throws(
      () => retryDelay({ attempt, status: 503 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
