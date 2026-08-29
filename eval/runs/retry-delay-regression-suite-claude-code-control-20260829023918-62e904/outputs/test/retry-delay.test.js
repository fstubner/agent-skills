import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('exponential backoff calculation for server errors', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 500 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 500 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 500 }), 4000);
  assert.equal(retryDelay({ attempt: 6, status: 500 }), 8000);
  assert.equal(retryDelay({ attempt: 7, status: 500 }), 16000);
});

test('caps server error delays at 30000ms', () => {
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30000);
  assert.equal(retryDelay({ attempt: 9, status: 502 }), 30000);
  assert.equal(retryDelay({ attempt: 10, status: 599 }), 30000);
  assert.equal(retryDelay({ attempt: 100, status: 503 }), 30000);
});

test('handles all 5xx status codes', () => {
  for (let status = 500; status <= 599; status++) {
    assert.equal(retryDelay({ attempt: 2, status }), 500, `status ${status}`);
  }
});

test('rate limit (429) without retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 429 }), 2000);
});

test('rate limit (429) prefers valid retryAfterMs over backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100 }), 100);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: 1000 }), 1000);
});

test('rate limit (429) caps retryAfterMs at 30000ms', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 }), 30000);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 30001 }), 30000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 100000 }), 30000);
});

test('rate limit (429) ignores invalid retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: -100 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: Infinity }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: null }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: undefined }), 4000);
});

test('returns null for non-retriable status codes', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
  assert.equal(retryDelay({ attempt: 2, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 3, status: 401 }), null);
  assert.equal(retryDelay({ attempt: 4, status: 403 }), null);
  assert.equal(retryDelay({ attempt: 5, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 6, status: 499 }), null);
});

test('throws TypeError for invalid attempt values', () => {
  assert.throws(
    () => retryDelay({ attempt: 0, status: 500 }),
    TypeError,
    'attempt must be at least 1'
  );
  assert.throws(
    () => retryDelay({ attempt: -1, status: 500 }),
    TypeError
  );
  assert.throws(
    () => retryDelay({ attempt: 1.5, status: 500 }),
    TypeError,
    'attempt must be an integer'
  );
  assert.throws(
    () => retryDelay({ attempt: NaN, status: 500 }),
    TypeError
  );
  assert.throws(
    () => retryDelay({ attempt: null, status: 500 }),
    TypeError
  );
  assert.throws(
    () => retryDelay({ attempt: undefined, status: 500 }),
    TypeError
  );
});

test('retryAfterMs exactly at boundaries', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1 }), 1);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 29999 }), 29999);
});

test('timeout boundaries for status codes', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});
