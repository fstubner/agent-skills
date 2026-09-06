import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/pricing.js';

test('feeMinor calculates total rounded fee across line items', () => {
  // Example: 1000 + 2000 = 3000, 1.5% rate (150 basis points) -> 3000 * 150 / 10000 = 45
  assert.equal(feeMinor([1000, 2000], 150), 45);
});
