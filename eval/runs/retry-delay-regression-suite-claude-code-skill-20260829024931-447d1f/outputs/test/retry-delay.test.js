import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

// Invalid attempt validation
test('throws TypeError for non-integer attempt', () => {
  assert.throws(
    () => retryDelay({ attempt: 1.5, status: 503 }),
    { name: 'TypeError', message: 'attempt must be a positive integer' }
  );
});

test('throws TypeError for attempt < 1', () => {
  assert.throws(
    () => retryDelay({ attempt: 0, status: 503 }),
    { name: 'TypeError', message: 'attempt must be a positive integer' }
  );
});

test('throws TypeError for negative attempt', () => {
  assert.throws(
    () => retryDelay({ attempt: -1, status: 503 }),
    { name: 'TypeError', message: 'attempt must be a positive integer' }
  );
});

// Status 429 with valid retryAfterMs
test('429 uses retryAfterMs when provided and valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1000 }), 1000);
});

test('429 retryAfterMs capped at 30000', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 }), 30000);
});

test('429 retryAfterMs exactly 30000', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
});

test('429 retryAfterMs zero', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

// Status 429 with invalid/missing retryAfterMs (falls back to exponential backoff)
test('429 without retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
});

test('429 with null retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: null }), 500);
});

test('429 with undefined retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: undefined }), 500);
});

test('429 with negative retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -100 }), 500);
});

test('429 with non-finite retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: Infinity }), 500);
});

test('429 with NaN retryAfterMs uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }), 500);
});

// Server errors (500-599)
test('500 uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
});

test('503 uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('599 (boundary) uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 599 }), 500);
});

// Exponential backoff formula: 250 * 2^(attempt - 1), capped at 30000
test('exponential backoff attempt 1', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
});

test('exponential backoff attempt 2', () => {
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
});

test('exponential backoff attempt 3', () => {
  assert.equal(retryDelay({ attempt: 3, status: 500 }), 1000);
});

test('exponential backoff attempt 4', () => {
  assert.equal(retryDelay({ attempt: 4, status: 500 }), 2000);
});

test('exponential backoff attempt 5', () => {
  assert.equal(retryDelay({ attempt: 5, status: 500 }), 4000);
});

test('exponential backoff attempt 6', () => {
  assert.equal(retryDelay({ attempt: 6, status: 500 }), 8000);
});

test('exponential backoff attempt 7', () => {
  assert.equal(retryDelay({ attempt: 7, status: 500 }), 16000);
});

test('exponential backoff capped at 30000 for attempt 8', () => {
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30000);
});

test('exponential backoff capped at 30000 for large attempt', () => {
  assert.equal(retryDelay({ attempt: 100, status: 500 }), 30000);
});

// Status boundaries and non-retryable statuses
test('status 499 returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
});

test('status 400 returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
});

test('status 200 returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
});

test('status 428 returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 428 }), null);
});

test('status 600 returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});
