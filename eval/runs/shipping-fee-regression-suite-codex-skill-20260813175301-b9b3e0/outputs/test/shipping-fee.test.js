import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('normalizes country codes before calculating Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' ie ' }), 5);
});

test('normalizes the country helper', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry(), '');
});

test('charges the full base fee for a non-member in Great Britain', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('halves the country-specific fee for members', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('provides free shipping at and above the threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 101, member: true, country: 'GB' }), 0);
});

test('returns null for countries without shipping coverage', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});
