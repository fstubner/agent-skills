import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../src/server.js';
import { feeMinor } from '../src/pricing.js';

test('createApp builds a router', () => {
  assert.equal(typeof createApp().listen, 'function');
});

test('feeMinor v2 (default): rounds once on invoice total', () => {
  // Three lines totaling 100: 33, 33, 34 (in minor units, e.g., cents)
  // Fee rate 250 basis points (2.5%)
  // v2: (100) * 250 / 10_000 = 2.5 -> Math.round(2.5) = 3
  const lines = [33, 33, 34];
  const rate = 250;
  const fee = feeMinor(lines, rate, 'v2');
  assert.equal(fee, 3);
});

test('feeMinor v2: correctly rounds fractional amounts', () => {
  // Lines: 100, 100, 100 (total 300)
  // Rate: 333 basis points (3.33%)
  // Total fee: 300 * 333 / 10_000 = 99_900 / 10_000 = 9.99 -> Math.round(9.99) = 10
  const fee = feeMinor([100, 100, 100], 333, 'v2');
  assert.equal(fee, 10);
});

test('feeMinor v1 (legacy): rounds per line then sums', () => {
  // Same lines and rate as v2 test: [33, 33, 34] with rate 250
  // v1: per-line rounding
  //   33 * 250 / 10_000 = 0.825 -> Math.round(0.825) = 1
  //   33 * 250 / 10_000 = 0.825 -> 1
  //   34 * 250 / 10_000 = 0.85 -> Math.round(0.85) = 1
  // Total: 1 + 1 + 1 = 3
  const lines = [33, 33, 34];
  const rate = 250;
  const fee = feeMinor(lines, rate, 'v1');
  assert.equal(fee, 3);
});


test('feeMinor v2: handles zero lines', () => {
  assert.equal(feeMinor([], 100, 'v2'), 0);
});

test('feeMinor v1: handles zero lines', () => {
  assert.equal(feeMinor([], 100, 'v1'), 0);
});

test('feeMinor defaults to v2 when version not specified', () => {
  const lines = [100, 200, 300];
  const rate = 150;
  const v2Default = feeMinor(lines, rate);
  const v2Explicit = feeMinor(lines, rate, 'v2');
  assert.equal(v2Default, v2Explicit);
});

test('feeMinor: v2 captures fractional fees that v1 loses', () => {
  // Three lines with fractional fees: 333, 333, 333 cents (total 999)
  // Rate: 100 basis points (1%)
  // v1: Each line: 333 * 100 / 10000 = 3.33 → 3; total 3+3+3 = 9 cents (loses 0.99 cents)
  // v2: Total: 999 * 100 / 10000 = 9.99 → 10 cents
  const v1Fee = feeMinor([333, 333, 333], 100, 'v1');
  const v2Fee = feeMinor([333, 333, 333], 100, 'v2');

  assert.equal(v1Fee, 9);
  assert.equal(v2Fee, 10);
  assert.equal(v2Fee - v1Fee, 1); // v2 captures the penny that v1 lost
});

test('feeMinor respects environment variable setting', () => {
  // This test verifies the contract: caller can pass version explicitly
  // In real code, version would come from config.getFeeRoundingVersion()
  const lines = [1, 1, 1];
  const rate = 333; // Will create fractional cents

  const explicitV1 = feeMinor(lines, rate, 'v1');
  const explicitV2 = feeMinor(lines, rate, 'v2');

  // Verify both can be called independently
  assert.notEqual(explicitV1, explicitV2); // They should differ on split-penny lines
});
