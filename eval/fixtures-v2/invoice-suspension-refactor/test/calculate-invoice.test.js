import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoice } from '../src/calculate-invoice.js';

test('active basic account', () => {
  assert.equal(calculateInvoice({ plan: 'basic', usage: 50, currency: 'USD' }), 20);
});

test('active pro usage and coupon', () => {
  assert.equal(calculateInvoice({ plan: 'pro', usage: 150, currency: 'USD', coupon: 'SAVE10' }), 50);
});
