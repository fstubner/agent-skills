import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// _normalizeCountry tests
test('_normalizeCountry: handles null', () => {
  assert.equal(_normalizeCountry(null), '');
});

test('_normalizeCountry: handles undefined', () => {
  assert.equal(_normalizeCountry(undefined), '');
});

test('_normalizeCountry: trims and uppercases', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('_normalizeCountry: converts numbers to string', () => {
  assert.equal(_normalizeCountry(123), '123');
});

test('_normalizeCountry: handles already uppercase', () => {
  assert.equal(_normalizeCountry('GB'), 'GB');
});

test('_normalizeCountry: handles lowercase', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
});

test('_normalizeCountry: handles mixed case with whitespace', () => {
  assert.equal(_normalizeCountry('  gB  '), 'GB');
});

// shippingFee: Ireland tests
test('shippingFee: Ireland non-member below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

test('shippingFee: Ireland member below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('shippingFee: Ireland case insensitive (lowercase)', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
});

test('shippingFee: Ireland with whitespace', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' IE ' }), 5);
});

test('shippingFee: Ireland at subtotal 100 (free shipping)', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('shippingFee: Ireland above subtotal 100 (free shipping)', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

test('shippingFee: Ireland member at subtotal 100 (free shipping)', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

// shippingFee: GB tests
test('shippingFee: GB non-member below 100', () => {
  assert.equal(shippingFee({ subtotal: 50, member: false, country: 'GB' }), 10);
});

test('shippingFee: GB member below 100', () => {
  assert.equal(shippingFee({ subtotal: 50, member: true, country: 'GB' }), 5);
});

test('shippingFee: GB case insensitive (lowercase)', () => {
  assert.equal(shippingFee({ subtotal: 50, country: 'gb' }), 10);
});

test('shippingFee: GB with whitespace', () => {
  assert.equal(shippingFee({ subtotal: 50, country: ' GB ' }), 10);
});

test('shippingFee: GB at subtotal 100 (free shipping)', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('shippingFee: GB above subtotal 100 (free shipping)', () => {
  assert.equal(shippingFee({ subtotal: 200, country: 'GB' }), 0);
});

test('shippingFee: GB member at subtotal 100 (free shipping)', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// shippingFee: Invalid country tests
test('shippingFee: Invalid country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: 'US' }), null);
});

test('shippingFee: Empty country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: '' }), null);
});

test('shippingFee: Null country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: null }), null);
});

test('shippingFee: Undefined country returns null', () => {
  assert.equal(shippingFee({ subtotal: 50, country: undefined }), null);
});

test('shippingFee: Invalid country with high subtotal still returns null', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'FR' }), null);
});

// shippingFee: Default member value tests
test('shippingFee: Default member=false for Ireland', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('shippingFee: Default member=false for GB', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

// shippingFee: Edge cases for subtotal
test('shippingFee: Subtotal 99.99 (just below 100)', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
});

test('shippingFee: Subtotal 0', () => {
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
});

test('shippingFee: Negative subtotal still charged', () => {
  assert.equal(shippingFee({ subtotal: -50, country: 'IE' }), 5);
});
