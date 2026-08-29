import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('exponential backoff for 5xx errors', () => {
  assert.equal(retryDelay({ attempt: 1, status: 503 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 503 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 503 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 503 }), 4000);
  assert.equal(retryDelay({ attempt: 6, status: 503 }), 8000);
  assert.equal(retryDelay({ attempt: 7, status: 503 }), 16000);
});

test('caps 5xx backoff at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30000);
  assert.equal(retryDelay({ attempt: 10, status: 503 }), 30000);
  assert.equal(retryDelay({ attempt: 100, status: 503 }), 30000);
});

test('all 5xx codes use exponential backoff', () => {
  for (let status = 500; status <= 599; status++) {
    assert.equal(retryDelay({ attempt: 2, status }), 500, `status ${status} should backoff to 500ms`);
  }
});

test('429 status without retry-after uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
});

test('429 status with valid retry-after uses that value', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100 }), 100);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: 1000 }), 1000);
});

test('429 status caps retry-after at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: Infinity }), 30000);
});

test('429 status with invalid retry-after falls back to exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -100 }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: undefined }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: null }), 500);
});

test('non-retriable statuses return null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 401 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('validates attempt is a positive integer', () => {
  assert.throws(
    () => retryDelay({ attempt: 0, status: 503 }),
    TypeError,
    'attempt must be at least 1'
  );
  assert.throws(
    () => retryDelay({ attempt: -1, status: 503 }),
    TypeError,
    'attempt must be positive'
  );
  assert.throws(
    () => retryDelay({ attempt: 1.5, status: 503 }),
    TypeError,
    'attempt must be an integer'
  );
  assert.throws(
    () => retryDelay({ attempt: NaN, status: 503 }),
    TypeError,
    'attempt must be a number'
  );
  assert.throws(
    () => retryDelay({ attempt: 'one', status: 503 }),
    TypeError,
    'attempt must be a number'
  );
});

test('boundary case: attempt 1 with 250ms base', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
});

test('boundary case: retry-after exactly at limit', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 29999 }), 29999);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

test('retry-after zero is valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});
