import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoice } from '../src/calculate-invoice.js';

test('active basic account', () => {
  assert.equal(calculateInvoice({ plan: 'basic', usage: 50, currency: 'USD' }), 20);
});

test('active pro usage and coupon', () => {
  assert.equal(calculateInvoice({ plan: 'pro', usage: 150, currency: 'USD', coupon: 'SAVE10' }), 50);
});

test('suspended account owes nothing regardless of billing inputs', () => {
  assert.equal(
    calculateInvoice({
      status: 'suspended',
      plan: 'pro',
      usage: 1000,
      currency: 'EUR',
      coupon: 'SAVE10',
    }),
    0,
  );
});

test('suspended account owes nothing even with unknown billing inputs', () => {
  assert.equal(
    calculateInvoice({
      status: 'suspended',
      plan: 'unknown',
      usage: 0,
      currency: 'GBP',
      coupon: 'NOT_A_COUPON',
    }),
    0,
  );
});
