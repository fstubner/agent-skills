import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('rejects attempts that are not positive integers', () => {
  for (const attempt of [0, -1, 1.5, NaN, Infinity, '1', null, undefined]) {
    assert.throws(
      () => retryDelay({ attempt, status: 503 }),
      { name: 'TypeError', message: 'attempt must be a positive integer' },
    );
  }
});

test('uses the retry-after value for rate limits when it is valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1250 }), 1250);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30_000 }), 30_000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 45_000 }), 30_000);
});

test('falls back to exponential backoff for invalid rate-limit hints', () => {
  for (const retryAfterMs of [-1, NaN, Infinity, -Infinity, '1000', null, undefined]) {
    assert.equal(
      retryDelay({ attempt: 2, status: 429, retryAfterMs }),
      500,
      `invalid retry-after value: ${String(retryAfterMs)}`,
    );
  }
});

test('backs off server errors exponentially and caps the delay', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 599 }), 1000);
  assert.equal(retryDelay({ attempt: 9, status: 500 }), 30_000);
});

test('does not retry non-rate-limit and non-server-error statuses', () => {
  for (const status of [199, 200, 301, 400, 404, 429 - 1, 600, undefined]) {
    assert.equal(retryDelay({ attempt: 1, status }), null, `status: ${String(status)}`);
  }
});
