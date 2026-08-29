import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Normalization tests
test('normalizes the private country helper', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('normalizes empty and null country values', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
  assert.equal(_normalizeCountry(''), '');
});

test('normalizes lowercase countries', () => {
  assert.equal(_normalizeCountry('gb'), 'GB');
  assert.equal(_normalizeCountry('ie'), 'IE');
});

// Irish shipping tests
test('Irish standard rate', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('Irish member discount', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('Irish free shipping above threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

test('Irish member still free above threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

// GB/UK shipping tests
test('GB standard rate', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('GB member discount', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('GB free shipping above threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

// Unsupported country tests
test('returns null for unsupported countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'DE' }), null);
});

test('returns null for null or undefined country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

test('returns null for empty string country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

// Edge cases
test('handles member false explicitly', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

test('subtotal exactly at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
});

test('case insensitive country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('whitespace handling in country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '  IE  ' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: '  GB  ' }), 10);
});
