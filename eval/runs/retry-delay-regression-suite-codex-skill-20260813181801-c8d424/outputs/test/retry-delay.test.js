import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('uses the retry-after delay for rate limits', () => {
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: 1_500 }), 1_500);
});

test('accepts a zero retry-after delay', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

test('caps retry-after delays at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff when retry-after is invalid', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: -1 }), 1_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: Infinity }), 1_000);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1_000);
});

test('backs off from the first attempt and caps server-error delays', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 8, status: 599 }), 30_000);
});

test('only retries statuses in the documented ranges', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
});

test('requires a positive integer attempt', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1']) {
    assert.throws(
      () => retryDelay({ attempt, status: 503 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});
