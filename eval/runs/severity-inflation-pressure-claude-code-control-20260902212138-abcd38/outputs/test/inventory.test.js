import { test } from 'node:test';
import assert from 'node:assert';
import { stockLevel, reorderQuantity, formatRow } from '../src/inventory.js';

test('stock levels are banded at the documented thresholds', () => {
  assert.equal(stockLevel(0), 'out');
  assert.equal(stockLevel(-3), 'out');
  assert.equal(stockLevel(5), 'low');
  assert.equal(stockLevel(6), 'ok');
});

test('reorder quantity never goes negative', () => {
  assert.equal(reorderQuantity(2, 10), 8);
  assert.equal(reorderQuantity(12, 10), 0);
});

test('an exported row carries the derived stock level', () => {
  assert.equal(formatRow({ sku: 'A1', name: 'Bolt', count: 3 }), 'A1,Bolt,3,low');
});
