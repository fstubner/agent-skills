import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('input validation', () => {
  // attempt must be a positive integer
  assert.throws(() => retryDelay({ attempt: 0, status: 503 }), TypeError, 'attempt < 1 throws');
  assert.throws(() => retryDelay({ attempt: -1, status: 503 }), TypeError, 'negative attempt throws');
  assert.throws(() => retryDelay({ attempt: 1.5, status: 503 }), TypeError, 'non-integer attempt throws');
  assert.throws(() => retryDelay({ attempt: 'abc', status: 503 }), TypeError, 'non-numeric attempt throws');
  assert.throws(() => retryDelay({ attempt: null, status: 503 }), TypeError, 'null attempt throws');
});

test('429 rate limit with retryAfterMs', () => {
  // Uses retryAfterMs when valid
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 1000 }), 1000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 60000 }), 30000); // capped at 30_000
});

test('429 rate limit without retryAfterMs uses backoff', () => {
  // Falls back to exponential backoff when retryAfterMs is missing
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 429 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 429 }), 4000);
});

test('429 rate limit with invalid retryAfterMs falls back to backoff', () => {
  // Negative or non-finite retryAfterMs values are ignored
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: -100 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -1 }), 500);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: Infinity }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }), 500);
});

test('429 rate limit with zero retryAfterMs', () => {
  // Zero is a valid finite number >= 0, so it's used
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: 0 }), 0);
});

test('5xx server errors use exponential backoff', () => {
  // Minimum of 5xx range (500)
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 500 }), 1000);

  // Maximum of 5xx range (599)
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 599 }), 500);

  // Middle values
  assert.equal(retryDelay({ attempt: 1, status: 503 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 1, status: 502 }), 250);
});

test('5xx backoff is capped at 30000ms', () => {
  // 250 * 2^6 = 250 * 64 = 16000
  assert.equal(retryDelay({ attempt: 7, status: 500 }), 16000);
  // 250 * 2^7 = 250 * 128 = 32000, but capped at 30000
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30000);
  // Even higher attempts stay at cap
  assert.equal(retryDelay({ attempt: 10, status: 500 }), 30000);
  assert.equal(retryDelay({ attempt: 100, status: 500 }), 30000);
});

test('non-retryable status codes return null', () => {
  // 4xx errors (except 429 which is handled)
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 2, status: 401 }), null);
  assert.equal(retryDelay({ attempt: 3, status: 403 }), null);
  assert.equal(retryDelay({ attempt: 4, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 5, status: 499 }), null);

  // 2xx and 3xx
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
  assert.equal(retryDelay({ attempt: 2, status: 201 }), null);
  assert.equal(retryDelay({ attempt: 3, status: 301 }), null);
  assert.equal(retryDelay({ attempt: 4, status: 304 }), null);

  // Boundary: 499 is not 5xx
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  // Boundary: 600 is not 5xx
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('exponential backoff formula (attempt 1-6)', () => {
  // Verify: 250 * 2^(attempt - 1)
  const baseDelay = 250;
  for (let attempt = 1; attempt <= 6; attempt++) {
    const expected = baseDelay * Math.pow(2, attempt - 1);
    const result = retryDelay({ attempt, status: 500 });
    assert.equal(result, expected, `attempt ${attempt} should equal ${expected}`);
  }
});

test('retryAfterMs respects the 30000ms cap', () => {
  // Values exactly at cap
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
  // Values above cap are capped
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30001 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100000 }), 30000);
});
