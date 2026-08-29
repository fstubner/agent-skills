import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Country normalization
test('normalizes lowercase country', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('normalizes mixed case country', () => {
  assert.equal(_normalizeCountry('Ie'), 'IE');
  assert.equal(_normalizeCountry('Gb'), 'GB');
});

test('normalizes country with whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('  GB  '), 'GB');
  assert.equal(_normalizeCountry('\tIE\n'), 'IE');
});

test('normalizes null and undefined to empty string', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('normalizes empty string', () => {
  assert.equal(_normalizeCountry(''), '');
});

// Ireland shipping (base: 5)
test('returns 5 for Irish non-member below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
});

test('returns 2.5 for Irish member below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 1, member: true, country: 'IE' }), 2.5);
});

// GB shipping (base: 10)
test('returns 10 for GB non-member below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

test('returns 5 for GB member below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

// Free shipping at 100+
test('returns 0 for subtotal >= 100 (IE)', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

test('returns 0 for subtotal >= 100 (GB)', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// Invalid countries
test('returns null for unsupported countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'DE' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'XX' }), null);
});

test('returns null for empty country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});

// Case insensitivity
test('handles case-insensitive country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
  assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
});

// Default member parameter
test('treats missing member parameter as false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, member: undefined, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});
