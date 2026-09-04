import { test } from 'node:test';
import assert from 'node:assert';
import { priceFor } from '../src/pricing.js';

test('a weekday order has no surcharge', () => {
  assert.equal(priceFor({ quantity: 2, date: '2026-09-02' }), 5000);
});

test('a weekend order carries the surcharge', () => {
  assert.equal(priceFor({ quantity: 2, date: '2026-09-05' }), 5500);
});
