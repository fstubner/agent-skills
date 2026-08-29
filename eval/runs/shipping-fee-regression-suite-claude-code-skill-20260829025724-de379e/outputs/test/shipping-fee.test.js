import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// _normalizeCountry tests
test('_normalizeCountry: lowercase input', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
});

test('_normalizeCountry: mixed case input', () => {
  assert.equal(_normalizeCountry('Ie'), 'IE');
});

test('_normalizeCountry: trims whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('_normalizeCountry: null converts to empty string', () => {
  assert.equal(_normalizeCountry(null), '');
});

test('_normalizeCountry: undefined converts to empty string', () => {
  assert.equal(_normalizeCountry(undefined), '');
});

test('_normalizeCountry: number input', () => {
  assert.equal(_normalizeCountry(123), '123');
});

// shippingFee: country validation
test('shippingFee: returns null for unsupported country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
});

test('shippingFee: returns null for empty country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

test('shippingFee: returns null for null country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
});

test('shippingFee: returns null for undefined country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});

// shippingFee: subtotal >= 100 (free shipping)
test('shippingFee: returns 0 for subtotal >= 100 (IE)', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('shippingFee: returns 0 for subtotal > 100 (GB)', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
});

test('shippingFee: returns 0 for subtotal >= 100 with member (IE)', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

// shippingFee: Ireland (IE) non-member
test('shippingFee: returns 5 for IE subtotal < 100 non-member', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('shippingFee: returns 5 for IE subtotal just below 100 non-member', () => {
  assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
});

// shippingFee: Ireland (IE) member
test('shippingFee: returns 2.5 for IE subtotal < 100 member', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('shippingFee: returns 2.5 for IE subtotal just below 100 member', () => {
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'IE' }), 2.5);
});

// shippingFee: GB (Great Britain) non-member
test('shippingFee: returns 10 for GB subtotal < 100 non-member', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('shippingFee: returns 10 for GB subtotal just below 100 non-member', () => {
  assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
});

// shippingFee: GB (Great Britain) member
test('shippingFee: returns 5 for GB subtotal < 100 member', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('shippingFee: returns 5 for GB subtotal just below 100 member', () => {
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'GB' }), 5);
});

// shippingFee: member parameter defaults to false
test('shippingFee: member parameter defaults to false', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

// shippingFee: case normalization in country parameter
test('shippingFee: normalizes lowercase country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
});

test('shippingFee: normalizes mixed case country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
});

test('shippingFee: normalizes country with whitespace', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' IE ' }), 5);
});
