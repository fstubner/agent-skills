import test from 'node:test';
import assert from 'node:assert/strict';

import { shippingFee } from '../src/shipping-fee.js';

test('normalizes country codes by trimming whitespace and ignoring case', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
});

test('returns null for countries without a supported shipping rate', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: ' ' }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

test('applies the free-shipping threshold at exactly 100 in either country', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB', member: true }), 0);
});

test('charges the standard Ireland rate below the threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 0, country: 'IE', member: true }), 2.5);
});

test('charges the standard Great Britain rate below the threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 0, country: ' GB ', member: true }), 5);
});
