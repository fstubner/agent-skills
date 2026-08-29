import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('input validation: attempt must be positive integer', () => {
  assert.throws(() => retryDelay({ attempt: 0, status: 503 }), TypeError);
  assert.throws(() => retryDelay({ attempt: -1, status: 503 }), TypeError);
  assert.throws(() => retryDelay({ attempt: 1.5, status: 503 }), TypeError);
  assert.throws(() => retryDelay({ attempt: 'abc', status: 503 }), TypeError);
  assert.throws(() => retryDelay({ attempt: null, status: 503 }), TypeError);
});

test('input validation: attempt must be at least 1', () => {
  assert.doesNotThrow(() => retryDelay({ attempt: 1, status: 503 }));
});

test('status 429 with retryAfterMs: uses header when valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 1000 }), 1000);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 5000 }), 5000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

test('status 429 with retryAfterMs: caps at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 31_000 }), 30_000);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100_000 }), 30_000);
});

test('status 429 with retryAfterMs: ignores negative values', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: -1000 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -5000 }), 500);
});

test('status 429 with retryAfterMs: ignores non-finite values', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: Infinity }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: NaN }), 250);
});

test('status 429 without retryAfterMs: uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 429 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 429 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 429 }), 4000);
  assert.equal(retryDelay({ attempt: 6, status: 429 }), 8000);
  assert.equal(retryDelay({ attempt: 7, status: 429 }), 16000);
  assert.equal(retryDelay({ attempt: 8, status: 429 }), 30000);
});

test('status 429 without retryAfterMs: caps exponential backoff at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 8, status: 429 }), 30_000);
  assert.equal(retryDelay({ attempt: 9, status: 429 }), 30_000);
  assert.equal(retryDelay({ attempt: 10, status: 429 }), 30_000);
});

test('status 429 with retryAfterMs undefined: uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: undefined }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: undefined }), 500);
});

test('status 429 with retryAfterMs null: uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: null }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: null }), 500);
});

test('status 500-599: uses exponential backoff', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 2, status: 502 }), 500);
  assert.equal(retryDelay({ attempt: 3, status: 503 }), 1000);
  assert.equal(retryDelay({ attempt: 4, status: 505 }), 2000);
  assert.equal(retryDelay({ attempt: 5, status: 599 }), 4000);
});

test('status 500-599: caps exponential backoff at 30 seconds', () => {
  assert.equal(retryDelay({ attempt: 8, status: 500 }), 30_000);
  assert.equal(retryDelay({ attempt: 9, status: 503 }), 30_000);
  assert.equal(retryDelay({ attempt: 10, status: 599 }), 30_000);
});

test('status 500-599: various server error codes', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 501 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 502 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 503 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 504 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
});

test('status 400: returns null (client error)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
});

test('status 401: returns null (authentication)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 401 }), null);
});

test('status 403: returns null (forbidden)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 403 }), null);
});

test('status 404: returns null (not found)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
});

test('status 499: returns null (outside 500-599 range)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
});

test('status 600: returns null (outside 500-599 range)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});

test('status 200: returns null (success)', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
});

test('status boundary: 500 is included', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
});

test('status boundary: 599 is included', () => {
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250);
});

test('status boundary: 429 is handled separately from 500-599', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 100 }), 100);
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
});

test('retryAfterMs validation: zero is valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }), 0);
});

test('retryAfterMs: does not affect non-429 statuses', () => {
  assert.equal(retryDelay({ attempt: 1, status: 503, retryAfterMs: 10_000 }), 250);
  assert.equal(retryDelay({ attempt: 1, status: 200, retryAfterMs: 10_000 }), null);
});
