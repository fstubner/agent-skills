import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('normalizes the private country helper', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('returns a result for a member', () => {
  assert.ok(shippingFee({ subtotal: 20, member: true, country: 'IE' }));
});
