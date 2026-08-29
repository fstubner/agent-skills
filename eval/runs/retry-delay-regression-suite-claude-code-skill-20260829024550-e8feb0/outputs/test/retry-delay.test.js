import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('throws TypeError for non-integer attempt', () => {
  assert.throws(
    () => retryDelay({ attempt: 1.5, status: 503 }),
    TypeError
  );
});

test('throws TypeError for attempt below 1', () => {
  assert.throws(
    () => retryDelay({ attempt: 0, status: 503 }),
    TypeError
  );
});

test('throws TypeError for negative attempt', () => {
  assert.throws(
    () => retryDelay({ attempt: -1, status: 503 }),
    TypeError
  );
});

test('429: uses retryAfterMs when provided and valid', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 5000 }), 5000);
});

test('429: caps retryAfterMs at 30000', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 }), 30000);
});

test('429: handles retryAfterMs of exactly 30000', () => {
  assert.equal(retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }), 30000);
});

test('429: falls back to backoff when retryAfterMs is zero', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: 0 }), 500);
});

test('429: falls back to backoff when retryAfterMs is negative', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: -100 }), 500);
});

test('429: falls back to backoff when retryAfterMs is NaN', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }), 500);
});

test('429: falls back to backoff when retryAfterMs is Infinity', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429, retryAfterMs: Infinity }), 500);
});

test('429: falls back to backoff when retryAfterMs is undefined', () => {
  assert.equal(retryDelay({ attempt: 2, status: 429 }), 500);
});

test('500-599: exponential backoff for attempt 1', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250);
});

test('500-599: exponential backoff for attempt 2', () => {
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500);
});

test('500-599: exponential backoff for attempt 3', () => {
  assert.equal(retryDelay({ attempt: 3, status: 502 }), 1000);
});

test('500-599: exponential backoff for attempt 4', () => {
  assert.equal(retryDelay({ attempt: 4, status: 504 }), 2000);
});

test('500-599: exponential backoff for attempt 5', () => {
  assert.equal(retryDelay({ attempt: 5, status: 505 }), 4000);
});

test('500-599: caps exponential backoff at 30000', () => {
  assert.equal(retryDelay({ attempt: 10, status: 500 }), 30000);
});

test('500-599: boundary status 500', () => {
  assert.equal(retryDelay({ attempt: 2, status: 500 }), 500);
});

test('500-599: boundary status 599', () => {
  assert.equal(retryDelay({ attempt: 2, status: 599 }), 500);
});

test('non-retriable status returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null);
});

test('404 not found returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null);
});

test('400 bad request returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null);
});

test('499 just below 500 returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null);
});

test('600 just above 599 returns null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null);
});
