import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// _normalizeCountry tests
test('_normalizeCountry: normalizes lowercase to uppercase', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('_normalizeCountry: handles mixed case', () => {
  assert.equal(_normalizeCountry('Ie'), 'IE');
  assert.equal(_normalizeCountry('gB'), 'GB');
});

test('_normalizeCountry: trims whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('  GB  '), 'GB');
  assert.equal(_normalizeCountry('\tie\n'), 'IE');
});

test('_normalizeCountry: handles null and undefined', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('_normalizeCountry: handles empty string', () => {
  assert.equal(_normalizeCountry(''), '');
});

// Irish shipping tests
test('Ireland: non-member shipping at €20 subtotal is €5', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('Ireland: non-member shipping at €50 subtotal is €5', () => {
  assert.equal(shippingFee({ subtotal: 50, country: 'IE' }), 5);
});

test('Ireland: non-member shipping at €99 subtotal is €5', () => {
  assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
});

test('Ireland: member shipping is half price (€2.50)', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('Ireland: free shipping for non-member at €100 subtotal', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('Ireland: free shipping for member at €100 subtotal', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

test('Ireland: free shipping for non-member at €150 subtotal', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

// Great Britain shipping tests
test('Great Britain: non-member shipping at €20 subtotal is €10', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('Great Britain: non-member shipping at €50 subtotal is €10', () => {
  assert.equal(shippingFee({ subtotal: 50, country: 'GB' }), 10);
});

test('Great Britain: non-member shipping at €99 subtotal is €10', () => {
  assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
});

test('Great Britain: member shipping is half price (€5)', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('Great Britain: free shipping for non-member at €100 subtotal', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('Great Britain: free shipping for member at €100 subtotal', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

test('Great Britain: free shipping for non-member at €150 subtotal', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
});

// Country normalization in shippingFee
test('shippingFee: accepts lowercase country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
});

test('shippingFee: accepts mixed case country codes', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gB' }), 10);
});

test('shippingFee: accepts country codes with whitespace', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' IE ' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: '  GB  ' }), 10);
});

// Unsupported countries
test('shippingFee: returns null for unsupported country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'DE' }), null);
});

test('shippingFee: returns null for null/undefined country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
  assert.equal(shippingFee({ subtotal: 20 }), null);
});

test('shippingFee: returns null for empty country string', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: '   ' }), null);
});

// Edge cases with subtotal
test('shippingFee: handles zero subtotal', () => {
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 0, country: 'GB' }), 10);
});

test('shippingFee: handles very large subtotal', () => {
  assert.equal(shippingFee({ subtotal: 99999, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 99999, country: 'GB' }), 0);
});

test('shippingFee: handles decimal subtotal amounts', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 100.01, country: 'IE' }), 0);
});

// Member parameter defaults to false
test('shippingFee: member parameter defaults to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

test('shippingFee: member parameter accepts truthy/falsy values', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: 1, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 20, member: 0, country: 'IE' }), 5);
});
