import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('exponential backoff timing for server errors', () => {
  // Formula: Math.min(250 * 2^(attempt-1), 30_000)
  assert.equal(retryDelay({ attempt: 1, status: 503 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 503 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 503 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 503 }), 4000);
  assert.equal(retryDelay({ attempt: 6, status: 503 }), 8000);
  assert.equal(retryDelay({ attempt: 7, status: 503 }), 16000);
});

test('respects 30_000ms cap on server errors', () => {
  // At attempt 8: 250 * 2^7 = 32_000 > 30_000
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30_000);
  assert.equal(retryDelay({ attempt: 9, status: 503 }), 30_000);
  assert.equal(retryDelay({ attempt: 100, status: 503 }), 30_000);
});

test('respects all 5xx status codes', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 502 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 504 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
});

test('rate limit (429) without retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
});

test('rate limit (429) respects valid retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1000 }), 1000);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: 100 }), 100);
});

test('rate limit (429) caps retryAfterMs at 30_000ms', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 31_000 }), 30_000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50_000 }), 30_000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: Infinity }), 30_000);
});

test('rate limit (429) ignores invalid retryAfterMs and uses backoff', () => {
  // retryAfterMs: null should fall back to backoff
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: null }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: null }), 500);

  // NaN should fall back to backoff
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: NaN }), 250);

  // Negative values should fall back to backoff
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: -100 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -1 }), 500);
});

test('rate limit (429) treats undefined retryAfterMs as missing', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: undefined }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
});

test('returns null for non-retryable status codes', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 201 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 401 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 403 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
});

test('throws for invalid attempt values', () => {
  assert.throws(
    () => retryDelay({ attempt: 0, status: 503 }),
    TypeError,
    'attempt must be a positive integer'
  );

  assert.throws(
    () => retryDelay({ attempt: -1, status: 503 }),
    TypeError,
    'attempt must be a positive integer'
  );

  assert.throws(
    () => retryDelay({ attempt: 1.5, status: 503 }),
    TypeError,
    'attempt must be a positive integer'
  );

  assert.throws(
    () => retryDelay({ attempt: Infinity, status: 503 }),
    TypeError,
    'attempt must be a positive integer'
  );

  assert.throws(
    () => retryDelay({ attempt: NaN, status: 503 }),
    TypeError,
    'attempt must be a positive integer'
  );
});

test('respects 0ms boundary for retryAfterMs', () => {
  // 0 is a valid finite non-negative value
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: 0 }), 0);
});

test('boundary values at exponential escalation points', () => {
  // Test around key power-of-2 boundaries
  assert.equal(retryDelay({ attempt: 7, status: 503 }), 16000); // 250 * 64
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30_000); // 250 * 128 = 32_000 (capped)

  // Verify the cap is exact
  const attempt8 = 250 * Math.pow(2, 7); // 32_000
  assert.equal(attempt8, 32_000);
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30_000);
});
