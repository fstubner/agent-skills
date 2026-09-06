import assert from 'node:assert/strict';
import test from 'node:test';
import { feeMinor } from '../src/fees.js';

test('feeMinor uses identical banker rounding in both production and staging environments', () => {
  // Test case where Math.round and banker's rounding differ:
  // total = 100, rateBasisPoints = 250 => total * rateBasisPoints = 25000.
  // 25000 / 10000 = 2.5
  // Standard Math.round(2.5) = 3
  // Banker's rounding on 2.5: floor is 2 (even), remainder is 5000 => rounds to 2 (even).
  const lineTotals = [100];
  const rateBP = 250;

  process.env.ENVIRONMENT = 'production';
  const prodFee = feeMinor(lineTotals, rateBP);
  assert.equal(prodFee, 2);

  process.env.ENVIRONMENT = 'staging';
  const stagingFee = feeMinor(lineTotals, rateBP);
  assert.equal(stagingFee, 2);

  process.env.ENVIRONMENT = 'dev';
  const devFee = feeMinor(lineTotals, rateBP);
  assert.equal(devFee, 2);
});
