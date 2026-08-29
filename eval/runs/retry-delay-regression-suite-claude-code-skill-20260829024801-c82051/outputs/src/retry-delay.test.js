import { test } from 'node:test';
import * as assert from 'node:assert';
import { retryDelay } from './retry-delay.js';

test('retryDelay - input validation', async (t) => {
  await t.test('throws on non-integer attempt', () => {
    assert.throws(() => retryDelay({ attempt: 1.5, status: 429 }), TypeError);
  });

  await t.test('throws on attempt < 1', () => {
    assert.throws(() => retryDelay({ attempt: 0, status: 429 }), TypeError);
  });

  await t.test('throws on negative attempt', () => {
    assert.throws(() => retryDelay({ attempt: -1, status: 429 }), TypeError);
  });
});

test('retryDelay - 429 status with retryAfter', async (t) => {
  await t.test('returns retryAfter when provided and finite', () => {
    const result = retryDelay({ attempt: 1, status: 429, retryAfterMs: 1000 });
    assert.strictEqual(result, 1000);
  });

  await t.test('caps retryAfter at 30000ms', () => {
    const result = retryDelay({ attempt: 1, status: 429, retryAfterMs: 50000 });
    assert.strictEqual(result, 30000);
  });

  await t.test('treats negative retryAfter as null', () => {
    const result = retryDelay({ attempt: 1, status: 429, retryAfterMs: -100 });
    assert.strictEqual(result, 250);
  });

  await t.test('treats non-finite retryAfter as null', () => {
    const result = retryDelay({ attempt: 1, status: 429, retryAfterMs: Infinity });
    assert.strictEqual(result, 250);
  });

  await t.test('treats NaN retryAfter as null', () => {
    const result = retryDelay({ attempt: 1, status: 429, retryAfterMs: NaN });
    assert.strictEqual(result, 250);
  });

  await t.test('treats zero retryAfter as valid', () => {
    const result = retryDelay({ attempt: 1, status: 429, retryAfterMs: 0 });
    assert.strictEqual(result, 0);
  });
});

test('retryDelay - 429 status without retryAfter (exponential backoff)', async (t) => {
  await t.test('attempt 1 returns 250ms', () => {
    const result = retryDelay({ attempt: 1, status: 429 });
    assert.strictEqual(result, 250);
  });

  await t.test('attempt 2 returns 500ms', () => {
    const result = retryDelay({ attempt: 2, status: 429 });
    assert.strictEqual(result, 500);
  });

  await t.test('attempt 3 returns 1000ms', () => {
    const result = retryDelay({ attempt: 3, status: 429 });
    assert.strictEqual(result, 1000);
  });

  await t.test('attempt 4 returns 2000ms', () => {
    const result = retryDelay({ attempt: 4, status: 429 });
    assert.strictEqual(result, 2000);
  });

  await t.test('attempt 5 returns 4000ms', () => {
    const result = retryDelay({ attempt: 5, status: 429 });
    assert.strictEqual(result, 4000);
  });

  await t.test('attempt 6 returns 8000ms', () => {
    const result = retryDelay({ attempt: 6, status: 429 });
    assert.strictEqual(result, 8000);
  });

  await t.test('attempt 7 returns 16000ms', () => {
    const result = retryDelay({ attempt: 7, status: 429 });
    assert.strictEqual(result, 16000);
  });

  await t.test('attempt 8 would exceed 30000ms cap', () => {
    const result = retryDelay({ attempt: 8, status: 429 });
    assert.strictEqual(result, 30000);
  });

  await t.test('attempt 10 respects 30000ms cap', () => {
    const result = retryDelay({ attempt: 10, status: 429 });
    assert.strictEqual(result, 30000);
  });
});

test('retryDelay - 5xx status (exponential backoff)', async (t) => {
  await t.test('500 status - attempt 1 returns 250ms', () => {
    const result = retryDelay({ attempt: 1, status: 500 });
    assert.strictEqual(result, 250);
  });

  await t.test('500 status - attempt 2 returns 500ms', () => {
    const result = retryDelay({ attempt: 2, status: 500 });
    assert.strictEqual(result, 500);
  });

  await t.test('599 status - attempt 1 returns 250ms', () => {
    const result = retryDelay({ attempt: 1, status: 599 });
    assert.strictEqual(result, 250);
  });

  await t.test('599 status - attempt 3 returns 1000ms', () => {
    const result = retryDelay({ attempt: 3, status: 599 });
    assert.strictEqual(result, 1000);
  });

  await t.test('5xx status ignores retryAfter parameter', () => {
    const result = retryDelay({ attempt: 1, status: 500, retryAfterMs: 5000 });
    assert.strictEqual(result, 250);
  });

  await t.test('5xx status respects 30000ms cap', () => {
    const result = retryDelay({ attempt: 8, status: 503 });
    assert.strictEqual(result, 30000);
  });
});

test('retryDelay - non-retryable status codes', async (t) => {
  await t.test('returns null for 4xx status', () => {
    const result = retryDelay({ attempt: 1, status: 404 });
    assert.strictEqual(result, null);
  });

  await t.test('returns null for 400 status', () => {
    const result = retryDelay({ attempt: 1, status: 400 });
    assert.strictEqual(result, null);
  });

  await t.test('returns null for 499 status', () => {
    const result = retryDelay({ attempt: 1, status: 499 });
    assert.strictEqual(result, null);
  });

  await t.test('returns null for 2xx status', () => {
    const result = retryDelay({ attempt: 1, status: 200 });
    assert.strictEqual(result, null);
  });

  await t.test('returns null for 3xx status', () => {
    const result = retryDelay({ attempt: 1, status: 301 });
    assert.strictEqual(result, null);
  });

  await t.test('returns null for status 600+', () => {
    const result = retryDelay({ attempt: 1, status: 600 });
    assert.strictEqual(result, null);
  });
});

test('retryDelay - 429 vs 5xx behavior difference', async (t) => {
  await t.test('429 uses retryAfter when provided, 5xx ignores it', () => {
    const result429 = retryDelay({ attempt: 2, status: 429, retryAfterMs: 8000 });
    const result500 = retryDelay({ attempt: 2, status: 500, retryAfterMs: 8000 });

    assert.strictEqual(result429, 8000);
    assert.strictEqual(result500, 500);
  });

  await t.test('both use exponential backoff but 429 prefers retryAfter', () => {
    // 429 with no retryAfter should match 5xx backoff
    const result429 = retryDelay({ attempt: 3, status: 429 });
    const result500 = retryDelay({ attempt: 3, status: 500 });

    assert.strictEqual(result429, result500);
  });
});

test('retryDelay - boundary conditions for 5xx range', async (t) => {
  await t.test('status 500 is retryable', () => {
    const result = retryDelay({ attempt: 1, status: 500 });
    assert.strictEqual(result, 250);
  });

  await t.test('status 599 is retryable', () => {
    const result = retryDelay({ attempt: 1, status: 599 });
    assert.strictEqual(result, 250);
  });

  await t.test('status 499 is not retryable', () => {
    const result = retryDelay({ attempt: 1, status: 499 });
    assert.strictEqual(result, null);
  });

  await t.test('status 600 is not retryable', () => {
    const result = retryDelay({ attempt: 1, status: 600 });
    assert.strictEqual(result, null);
  });
});
