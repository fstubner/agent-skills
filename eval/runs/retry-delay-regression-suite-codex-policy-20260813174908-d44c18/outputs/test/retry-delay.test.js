import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off 5xx responses exponentially and caps the delay', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 8].map((attempt) => retryDelay({ attempt, status: 503 })),
    [250, 500, 1_000, 2_000, 30_000],
  );
});

test('uses a valid Retry-After delay for rate limits', () => {
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 1_250 }), 1_250);
});

test('caps Retry-After delays at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid Retry-After values', () => {
  for (const retryAfterMs of [-1, Number.NaN, Number.POSITIVE_INFINITY, '1000', null]) {
    assert.equal(
      retryDelay({ attempt: 3, status: 429, retryAfterMs }),
      1_000,
      `retryAfterMs=${String(retryAfterMs)}`,
    );
  }
});

test('does not retry non-retryable statuses', () => {
  for (const status of [200, 400, 404, 499, 600]) {
    assert.equal(retryDelay({ attempt: 1, status }), null);
  }
});

test('accepts the retryable status boundaries', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 75 }), 75);
});

test('requires a positive integer attempt', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1', null]) {
    assert.throws(
      () => retryDelay({ attempt, status: 503 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
