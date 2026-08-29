import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('input validation: rejects non-integer attempts', () => {
  assert.throws(() => retryDelay({ attempt: 1.5, status: 503 }), TypeError);
  assert.throws(() => retryDelay({ attempt: '1', status: 503 }), TypeError);
  assert.throws(() => retryDelay({ attempt: 0, status: 503 }), TypeError);
  assert.throws(() => retryDelay({ attempt: -1, status: 503 }), TypeError);
});

test('input validation: accepts positive integer attempts', () => {
  assert.equal(retryDelay({ attempt: 1, status: 503 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('exponential backoff for 5xx: attempt 1-6', () => {
  assert.equal(retryDelay({ attempt: 1, status: 503 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 503 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 503 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 503 }), 4000);
  assert.equal(retryDelay({ attempt: 6, status: 503 }), 8000);
});

test('exponential backoff capped at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 7, status: 503 }), 16000);
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30000);
  assert.equal(retryDelay({ attempt: 9, status: 503 }), 30000);
  assert.equal(retryDelay({ attempt: 100, status: 503 }), 30000);
});

test('all 5xx status codes: 500, 502, 599', () => {
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 502 }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 599 }), 500);
});

test('429 without retryAfterMs: exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
  assert.equal(retryDelay({ attempt: 8, status: 429 }), 30000);
});

test('429 with retryAfterMs: prefers retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100 }), 100);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: 15000 }), 15000);
});

test('429 with retryAfterMs capped at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 40000 }), 30000);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 35000 }), 30000);
});

test('429 with invalid retryAfterMs: falls back to exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -1 }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: Infinity }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 'invalid' }), 500);
});

test('non-retryable status codes: returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 401 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 403 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
});

test('boundary: 429 and 500-599 are retryable, 499 and 600 are not', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('retryAfterMs zero is valid', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 0 }), 0);
});
