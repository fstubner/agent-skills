import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('backs off all 5xx responses and caps the delay', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30_000);
});

test('does not retry non-retryable statuses', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('uses a valid Retry-After delay for rate limits', () => {
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 1_250 }), 1_250);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid Retry-After values', () => {
  const expected = 2_000;

  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: -1 }), expected);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: Number.NaN }), expected);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: Number.POSITIVE_INFINITY }), expected);
  assert.equal(retryDelay({ attempt: 4, status: 429 }), expected);
});

test('requires a positive integer attempt', () => {
  for (const attempt of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => retryDelay({ attempt, status: 500 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
