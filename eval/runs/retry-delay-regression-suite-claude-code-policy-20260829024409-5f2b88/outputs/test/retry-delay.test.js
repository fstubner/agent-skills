import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

// Exponential backoff tests
test('exponential backoff: attempt 1', () => {
  assert.equal(retryDelay({ attempt: 1, status: 503 }), 250);
});

test('exponential backoff: attempt 2', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('exponential backoff: attempt 3', () => {
  assert.equal(retryDelay({ attempt: 3, status: 503 }), 1000);
});

test('exponential backoff: attempt 4', () => {
  assert.equal(retryDelay({ attempt: 4, status: 503 }), 2000);
});

test('exponential backoff: attempt 5', () => {
  assert.equal(retryDelay({ attempt: 5, status: 503 }), 4000);
});

test('exponential backoff: attempt 6', () => {
  assert.equal(retryDelay({ attempt: 6, status: 503 }), 8000);
});

test('exponential backoff: attempt 7', () => {
  assert.equal(retryDelay({ attempt: 7, status: 503 }), 16000);
});

test('exponential backoff: attempt 8 capped at 30000', () => {
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30000);
});

test('exponential backoff: attempt 9 capped at 30000', () => {
  assert.equal(retryDelay({ attempt: 9, status: 503 }), 30000);
});

test('exponential backoff: high attempt capped at 30000', () => {
  assert.equal(retryDelay({ attempt: 100, status: 503 }), 30000);
});

// 5xx status code range tests
test('5xx errors: status 500', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
});

test('5xx errors: status 502', () => {
  assert.equal(retryDelay({ attempt: 2, status: 502 }), 500);
});

test('5xx errors: status 504', () => {
  assert.equal(retryDelay({ attempt: 3, status: 504 }), 1000);
});

test('5xx errors: status 599', () => {
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
});

test('5xx errors: status 501', () => {
  assert.equal(retryDelay({ attempt: 2, status: 501 }), 500);
});

// 429 rate limit handling
test('429 with valid retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100 }), 100);
});

test('429 with retryAfterMs 0', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

test('429 with retryAfterMs exceeding cap', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 40000 }), 30000);
});

test('429 with retryAfterMs at cap', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
});

test('429 with negative retryAfterMs falls back to backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -100 }), 500);
});

test('429 with NaN retryAfterMs falls back to backoff', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: NaN }), 1000);
});

test('429 with Infinity retryAfterMs falls back to backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: Infinity }), 500);
});

test('429 without retryAfterMs falls back to backoff', () => {
  assert.equal(retryDelay({ attempt: 4, status: 429 }), 2000);
});

test('429 with null retryAfterMs falls back to backoff', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: null }), 500);
});

test('429 with undefined retryAfterMs falls back to backoff', () => {
  assert.equal(retryDelay({ attempt: 3, status: 429, retryAfterMs: undefined }), 1000);
});

// Non-retryable status codes
test('non-retryable: status 200', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
});

test('non-retryable: status 201', () => {
  assert.equal(retryDelay({ attempt: 1, status: 201 }), null);
});

test('non-retryable: status 400', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
});

test('non-retryable: status 401', () => {
  assert.equal(retryDelay({ attempt: 1, status: 401 }), null);
});

test('non-retryable: status 403', () => {
  assert.equal(retryDelay({ attempt: 1, status: 403 }), null);
});

test('non-retryable: status 404', () => {
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
});

test('non-retryable: status 418', () => {
  assert.equal(retryDelay({ attempt: 1, status: 418 }), null);
});

// Status boundary tests
test('status 499 not retryable (below 5xx range)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
});

test('status 600 not retryable (above 5xx range)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

// Invalid attempt values
test('invalid attempt: 0 throws', () => {
  assert.throws(() => retryDelay({ attempt: 0, status: 503 }), TypeError);
});

test('invalid attempt: negative throws', () => {
  assert.throws(() => retryDelay({ attempt: -1, status: 503 }), TypeError);
});

test('invalid attempt: non-integer throws', () => {
  assert.throws(() => retryDelay({ attempt: 1.5, status: 503 }), TypeError);
});

test('invalid attempt: string throws', () => {
  assert.throws(() => retryDelay({ attempt: '1', status: 503 }), TypeError);
});

test('invalid attempt: null throws', () => {
  assert.throws(() => retryDelay({ attempt: null, status: 503 }), TypeError);
});
