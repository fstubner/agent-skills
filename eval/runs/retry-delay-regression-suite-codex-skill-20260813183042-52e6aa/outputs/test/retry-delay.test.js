import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('backs off from the first attempt and caps the delay', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 8, status: 599 }), 30_000);
  assert.equal(retryDelay({ attempt: 100, status: 500 }), 30_000);
});

test('backs off every status in the server-error range', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
});

test('uses a valid retry-after value for rate limits', () => {
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 1_200 }), 1_200);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid rate-limit hints', () => {
  const expected = 2_000;

  assert.equal(retryDelay({ attempt: 4, status: 429 }), expected);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: -1 }), expected);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: Number.NaN }), expected);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: Number.POSITIVE_INFINITY }), expected);
});

test('does not retry non-rate-limit, non-server responses', () => {
  assert.equal(retryDelay({ attempt: 3, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 3, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 3, status: 600 }), null);
});

test('requires a positive integer attempt', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1', null]) {
    assert.throws(
      () => retryDelay({ attempt, status: 500 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
