import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

// Input validation
test('throws TypeError when attempt is not an integer', () => {
  assert.throws(() => retryDelay({ attempt: 1.5, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: '1', status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: null, status: 500 }), TypeError);
});

test('throws TypeError when attempt is zero or negative', () => {
  assert.throws(() => retryDelay({ attempt: 0, status: 500 }), TypeError);
  assert.throws(() => retryDelay({ attempt: -1, status: 500 }), TypeError);
});

// 429 status: retryAfterMs provided
test('uses retryAfterMs for 429 when valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100 }), 100);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 5000 }), 5000);
});

test('caps retryAfterMs at 30s for 429', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 }), 30000);
});

test('falls back to exponential backoff for 429 with invalid retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: -1 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: Infinity }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: undefined }), 500);
});

test('uses exponential backoff for 429 without retryAfterMs', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
});

// Server errors (500-599)
test('backs off exponentially for 5xx errors', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 500 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 500 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 500 }), 4000);
});

test('respects 30s cap for 5xx exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 7, status: 503 }), 16000);
  assert.equal(retryDelay({ attempt: 8, status: 503 }), 30000);
  assert.equal(retryDelay({ attempt: 9, status: 503 }), 30000);
  assert.equal(retryDelay({ attempt: 20, status: 503 }), 30000);
});

test('handles all 5xx status codes', () => {
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 502 }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
  assert.equal(retryDelay({ attempt: 2, status: 599 }), 500);
});

// Non-retryable statuses
test('returns null for non-retryable statuses', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 401 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 403 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
});

test('returns null for 4xx errors', () => {
  assert.equal(retryDelay({ attempt: 2, status: 499 }), null);
});

// Edge cases
test('handles attempt = 1 correctly', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
});

test('caps retryAfterMs at 30s even for high attempts', () => {
  assert.equal(retryDelay({ attempt: 10, status: 429, retryAfterMs: 50000 }), 30000);
});

test('exponential backoff reaches and stays at cap', () => {
  const delays = [];
  for (let i = 1; i <= 10; i++) {
    delays.push(retryDelay({ attempt: i, status: 500 }));
  }
  // Verify exponential growth then cap
  assert.equal(delays[0], 250);
  assert.equal(delays[1], 500);
  assert.equal(delays[2], 1000);
  assert.equal(delays[3], 2000);
  assert.equal(delays[4], 4000);
  assert.equal(delays[5], 8000);
  assert.equal(delays[6], 16000);
  assert.equal(delays[7], 30000); // capped
  assert.equal(delays[8], 30000); // stays capped
  assert.equal(delays[9], 30000); // stays capped
});
