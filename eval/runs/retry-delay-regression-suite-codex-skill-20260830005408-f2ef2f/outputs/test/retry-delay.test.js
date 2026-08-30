import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('rejects attempts that are not positive integers', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1', null]) {
    assert.throws(
      () => retryDelay({ attempt, status: 503 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});

test('uses retry-after for rate limits when it is a finite non-negative number', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1_250 }), 1_250);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

test('caps retry-after and falls back to exponential backoff when unusable', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: -1 }), 1_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: Infinity }), 1_000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: '1000' }), 1_000);
});

test('backs off all server errors and caps the delay', () => {
  assert.deepEqual(
    [500, 501, 599].map((status) => retryDelay({ attempt: 1, status })),
    [250, 250, 250],
  );
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30_000);
});

test('does not retry statuses outside rate-limit and server-error ranges', () => {
  for (const status of [200, 400, 429 - 1, 600, undefined, null]) {
    assert.equal(retryDelay({ attempt: 1, status }), null);
  }
});
