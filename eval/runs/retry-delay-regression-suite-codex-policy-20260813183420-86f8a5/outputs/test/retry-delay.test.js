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
  assert.equal(retryDelay({ attempt: 100, status: 500 }), 30_000);
});

test('uses a valid retry-after value for rate limits', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 1_750 }), 1_750);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 30_000 }), 30_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid rate-limit delays', () => {
  const request = { attempt: 3, status: 429 };
  assert.equal(retryDelay(request), 1_000);
  assert.equal(retryDelay({ ...request, retryAfterMs: -1 }), 1_000);
  assert.equal(retryDelay({ ...request, retryAfterMs: Number.NaN }), 1_000);
  assert.equal(retryDelay({ ...request, retryAfterMs: Infinity }), 1_000);
  assert.equal(retryDelay({ ...request, retryAfterMs: '1000' }), 1_000);
});

test('retries only rate limits and 5xx statuses', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('rejects non-positive and non-integer attempts', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1']) {
    assert.throws(
      () => retryDelay({ attempt, status: 500 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
