import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Country normalization
test('normalizes Ireland (lowercase)', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
});

test('normalizes Ireland (mixed case with spaces)', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('normalizes Ireland (uppercase)', () => {
  assert.equal(_normalizeCountry('IE'), 'IE');
});

test('normalizes GB', () => {
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('handles null/undefined in normalization', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

// Ireland shipping - base fee
test('Ireland shipping fee is 5 for subtotal below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('Ireland shipping fee is 5 for subtotal 99', () => {
  assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
});

// GB shipping - base fee
test('GB shipping fee is 10 for subtotal below 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('GB shipping fee is 10 for subtotal 99', () => {
  assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
});

// Free shipping threshold
test('free shipping for Ireland at subtotal 100', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('free shipping for GB at subtotal 100', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('free shipping for Ireland at subtotal above 100', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

test('free shipping for GB at subtotal above 100', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
});

// Member discounts - Ireland
test('member Ireland shipping fee is half (2.5)', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('member Ireland free shipping at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

// Member discounts - GB
test('member GB shipping fee is half (5)', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('member GB free shipping at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// Unsupported countries
test('returns null for unsupported country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
});

test('returns null for unsupported country France', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
});

test('returns null for null country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
});

test('returns null for undefined country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});

test('returns null for empty string country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

// Default parameter behavior
test('member defaults to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('member can be explicitly false', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});
