import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// Country normalization
test('_normalizeCountry: normalizes lowercase', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('_normalizeCountry: normalizes mixed case', () => {
  assert.equal(_normalizeCountry('Ie'), 'IE');
  assert.equal(_normalizeCountry('gB'), 'GB');
});

test('_normalizeCountry: trims whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('\t gb \n'), 'GB');
});

test('_normalizeCountry: handles null/undefined', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('_normalizeCountry: handles empty string', () => {
  assert.equal(_normalizeCountry(''), '');
});

test('_normalizeCountry: converts numbers to uppercase', () => {
  assert.equal(_normalizeCountry(123), '123');
});

// Ireland shipping - basic
test('IE non-member: free shipping over threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('IE non-member: €5 fee under threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('IE non-member: €5 fee at minimum', () => {
  assert.equal(shippingFee({ subtotal: 0.01, country: 'IE' }), 5);
});

test('IE non-member: €5 fee just below threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
});

// GB shipping - basic
test('GB non-member: free shipping over threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('GB non-member: £10 fee under threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('GB non-member: £10 fee at minimum', () => {
  assert.equal(shippingFee({ subtotal: 0.01, country: 'GB' }), 10);
});

test('GB non-member: £10 fee just below threshold', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

// Member discounts
test('IE member: half fee under threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('GB member: half fee under threshold', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('IE member: free shipping over threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

test('GB member: free shipping over threshold', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// Unsupported countries
test('unsupported country: returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
});

test('unsupported country: null for FR', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
});

test('unsupported country: null for missing country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

test('unsupported country: null for whitespace-only country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '   ' }), null);
});

// Case insensitivity
test('country normalization: lowercase ie', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
});

test('country normalization: mixed case Gb', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
});

test('country normalization: uppercase with spaces', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' IE ' }), 5);
});

// Subtotal edge cases
test('zero subtotal: IE', () => {
  assert.equal(shippingFee({ subtotal: 0, country: 'IE' }), 5);
});

test('zero subtotal: GB member', () => {
  assert.equal(shippingFee({ subtotal: 0, member: true, country: 'GB' }), 5);
});

test('exactly 100 subtotal: free', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('large subtotal: free', () => {
  assert.equal(shippingFee({ subtotal: 1000, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 1000, country: 'GB' }), 0);
});

// Default member parameter
test('default member: false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE', member: false }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('member undefined treated as false', () => {
  const result = shippingFee({ subtotal: 20, country: 'IE', member: undefined });
  assert.equal(result, 5);
});
