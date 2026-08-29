import test from 'node:test';
import assert from 'node:assert/strict';
import { retryDelay } from '../src/retry-delay.js';

test('input validation - throws on non-integer attempt', () => {
  assert.throws(
    () => retryDelay({ attempt: 1.5, status: 503 }),
    TypeError,
    'should reject non-integer attempt'
  );
});

test('input validation - throws on attempt < 1', () => {
  assert.throws(
    () => retryDelay({ attempt: 0, status: 503 }),
    TypeError,
    'should reject attempt 0'
  );
  assert.throws(
    () => retryDelay({ attempt: -1, status: 503 }),
    TypeError,
    'should reject negative attempt'
  );
});

test('server errors 500-599 - exponential backoff with cap', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250, 'attempt 1 = 250 * 2^0');
  assert.equal(retryDelay({ attempt: 2, status: 503 }), 500, 'attempt 2 = 250 * 2^1');
  assert.equal(retryDelay({ attempt: 3, status: 599 }), 1000, 'attempt 3 = 250 * 2^2');
  assert.equal(retryDelay({ attempt: 4, status: 502 }), 2000, 'attempt 4 = 250 * 2^3');
  assert.equal(retryDelay({ attempt: 5, status: 500 }), 4000, 'attempt 5 = 250 * 2^4');
  assert.equal(retryDelay({ attempt: 6, status: 501 }), 8000, 'attempt 6 = 250 * 2^5');
  assert.equal(retryDelay({ attempt: 7, status: 503 }), 16000, 'attempt 7 = 250 * 2^6');
  assert.equal(retryDelay({ attempt: 8, status: 504 }), 30000, 'attempt 8 capped at 30000');
  assert.equal(retryDelay({ attempt: 10, status: 500 }), 30000, 'attempt 10 capped at 30000');
});

test('server errors - boundary cases', () => {
  assert.equal(retryDelay({ attempt: 1, status: 500 }), 250, 'status 500 is server error');
  assert.equal(retryDelay({ attempt: 1, status: 599 }), 250, 'status 599 is server error');
  assert.equal(retryDelay({ attempt: 1, status: 499 }), null, 'status 499 is not server error');
  assert.equal(retryDelay({ attempt: 1, status: 600 }), null, 'status 600 is not server error');
});

test('429 rate limit - prefers retryAfterMs when valid', () => {
  assert.equal(
    retryDelay({ attempt: 1, status: 429, retryAfterMs: 1000 }),
    1000,
    'uses retryAfterMs if provided and valid'
  );
  assert.equal(
    retryDelay({ attempt: 1, status: 429, retryAfterMs: 30000 }),
    30000,
    'accepts retryAfterMs at cap'
  );
  assert.equal(
    retryDelay({ attempt: 1, status: 429, retryAfterMs: 99999 }),
    30000,
    'caps retryAfterMs at 30000'
  );
});

test('429 rate limit - retryAfterMs edge cases', () => {
  assert.equal(
    retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 }),
    0,
    'accepts retryAfterMs of 0'
  );
  assert.equal(
    retryDelay({ attempt: 2, status: 429, retryAfterMs: -1 }),
    500,
    'falls back to backoff for negative retryAfterMs'
  );
  assert.equal(
    retryDelay({ attempt: 2, status: 429, retryAfterMs: null }),
    500,
    'falls back to backoff for null retryAfterMs'
  );
  assert.equal(
    retryDelay({ attempt: 2, status: 429, retryAfterMs: undefined }),
    500,
    'falls back to backoff for undefined retryAfterMs'
  );
  assert.equal(
    retryDelay({ attempt: 2, status: 429, retryAfterMs: NaN }),
    500,
    'falls back to backoff for NaN retryAfterMs'
  );
  assert.equal(
    retryDelay({ attempt: 2, status: 429, retryAfterMs: Infinity }),
    500,
    'falls back to backoff for Infinity retryAfterMs'
  );
});

test('429 rate limit - exponential backoff when retryAfterMs missing', () => {
  assert.equal(
    retryDelay({ attempt: 1, status: 429 }),
    250,
    'uses exponential backoff for attempt 1'
  );
  assert.equal(
    retryDelay({ attempt: 3, status: 429 }),
    1000,
    'uses exponential backoff for attempt 3'
  );
  assert.equal(
    retryDelay({ attempt: 8, status: 429 }),
    30000,
    'caps at 30000 ms'
  );
});

test('other statuses return null', () => {
  assert.equal(retryDelay({ attempt: 1, status: 200 }), null, 'status 200 returns null');
  assert.equal(retryDelay({ attempt: 1, status: 400 }), null, 'status 400 returns null');
  assert.equal(retryDelay({ attempt: 1, status: 404 }), null, 'status 404 returns null');
  assert.equal(retryDelay({ attempt: 1, status: 401 }), null, 'status 401 returns null');
});
