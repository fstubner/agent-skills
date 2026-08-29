import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('server errors: exponential backoff progression', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 502 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 599 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 504 }), 4000);
  assert.equal(retryDelay({ attempt: 6, status: 500 }), 8000);
});

test('server errors: respects 30-second cap', () => {
  assert.equal(retryDelay({ attempt: 7, status: 500 }), 16000);
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30000);
  assert.equal(retryDelay({ attempt: 9, status: 502 }), 30000);
  assert.equal(retryDelay({ attempt: 100, status: 599 }), 30000);
});

test('rate limit: uses retryAfterMs when provided', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 1000 }), 1000);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: 60000 }), 30000);
});

test('rate limit: respects 30-second cap on retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 40000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: Infinity }), 30000);
});

test('rate limit: falls back to exponential backoff without retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
  assert.equal(retryDelay({ attempt: 8, status: 429 }), 30000);
});

test('rate limit: handles invalid retryAfterMs gracefully', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: -100 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: NaN }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: null }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: undefined }), 500);
});

test('non-retryable status codes return null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('invalid attempt throws TypeError', () => {
  assert.throws(() => retryDelay({ attempt: 0, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: -1, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: 1.5, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: 'abc', status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: null, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: undefined, status: 500 }), TypeError);
});

test('all server error codes handled consistently', () => {
  for (let status = 500; status <= 599; status++) {
    const delay = retryDelay({ attempt: 3, status });
    assert.equal(delay, 1000, `status ${status} should use exponential backoff`);
  }
});
