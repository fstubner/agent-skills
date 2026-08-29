import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Country normalization
test('normalizes the private country helper', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('_normalizeCountry handles uppercase', () => {
  assert.equal(_normalizeCountry('IE'), 'IE');
});

test('_normalizeCountry handles null/undefined', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('_normalizeCountry handles whitespace', () => {
  assert.equal(_normalizeCountry('  GB  '), 'GB');
});

// Ireland shipping (base fee 5)
test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('Irish shipping is case-insensitive', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
});

test('Irish shipping with whitespace normalization', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' IE ' }), 5);
});

test('Irish member discount (half of 5)', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

// GB shipping (base fee 10)
test('British shipping has higher base fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('British shipping is case-insensitive', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
});

test('British member discount (half of 10)', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

// Free shipping threshold (subtotal >= 100)
test('free shipping at exactly 100', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('free shipping above 100', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

test('free shipping for members at 100', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

test('free shipping for GB at threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('charged for GB just under threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

// Unsupported countries
test('unsupported country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
});

test('unsupported country (lowercase) returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'fr' }), null);
});

test('missing country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

test('null country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
});

test('empty string country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

test('whitespace-only country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '  ' }), null);
});

// Member default behavior
test('member defaults to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('member explicitly false', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

// Edge cases
test('zero subtotal', () => {
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
});

test('negative subtotal (edge case)', () => {
  assert.equal(shippingFee({ subtotal: -10, country: 'IE' }), 5);
});
