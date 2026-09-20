import test from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/report.js';

test('exports positive counts', () => {
  assert.equal(toCsv([{ sku: 'A-1', count: 3 }]), 'sku,count\nA-1,3');
});
