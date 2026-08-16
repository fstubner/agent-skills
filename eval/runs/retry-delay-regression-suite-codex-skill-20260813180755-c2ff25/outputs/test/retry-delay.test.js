import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('uses the retry-after delay for rate limits, including zero', () => {
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 1_250 }), 1_250);
});

test('caps retry-after delays at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff when retry-after is invalid', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: -1 }), 1_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: Number.NaN }), 1_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: Number.POSITIVE_INFINITY }), 1_000);
});

test('exponentially backs off 5xx responses and caps the result', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 8, status: 599 }), 30_000);
  assert.equal(retryDelay({ attempt: 20, status: 503 }), 30_000);
});

test('does not retry non-rate-limit, non-server responses', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('rejects attempts that are not positive integers', () => {
  for (const attempt of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, '1', null]) {
    assert.throws(
      () => retryDelay({ attempt, status: 503 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
