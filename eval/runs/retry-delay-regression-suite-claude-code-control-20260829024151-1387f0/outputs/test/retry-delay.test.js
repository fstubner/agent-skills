import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('backs off server errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('5xx error exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 502 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 503 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 504 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 599 }), 4000);
});

test('5xx error caps at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 7, status: 500 }), 8000);
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 16000);
  assert.equal(retryDelay({ attempt: 9, status: 500 }), 30000);
  assert.equal(retryDelay({ attempt: 10, status: 500 }), 30000);
  assert.equal(retryDelay({ attempt: 100, status: 500 }), 30000);
});

test('429 with retryAfterMs uses provided value', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1000 }), 1000);
  assert.equal(retryDelay({ attempt: 5, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
});

test('429 with retryAfterMs caps at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100000 }), 30000);
});

test('429 without retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
});

test('429 with invalid retryAfterMs falls back to exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: -100 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: null }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: NaN }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 429, retryAfterMs: Infinity }), 2000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 'invalid' }), 250);
});

test('non-5xx non-429 status returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 498 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('invalid attempt throws TypeError', () => {
  assert.throws(() => retryDelay({ attempt: 0, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: -1, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: 1.5, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: 'invalid', status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: null, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: undefined, status: 500 }), TypeError);
});

test('5xx range boundaries', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('zero retryAfterMs is valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

test('fractional retryAfterMs rounds correctly', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 123.456 }), 123.456);
});
