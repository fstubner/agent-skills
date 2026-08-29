import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

// _normalizeCountry tests
test('normalizeCountry: converts to uppercase', () => {
  assert.equal(_normalizeCountry('ie'), 'IE');
  assert.equal(_normalizeCountry('gb'), 'GB');
});

test('normalizeCountry: trims whitespace', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
  assert.equal(_normalizeCountry('  GB  '), 'GB');
});

test('normalizeCountry: handles null and undefined', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
});

test('normalizeCountry: handles empty string', () => {
  assert.equal(_normalizeCountry(''), '');
});

test('normalizeCountry: coerces non-string input', () => {
  assert.equal(_normalizeCountry(123), '123');
});

// shippingFee basic behavior tests
test('shippingFee: returns null for unsupported countries', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

test('shippingFee: returns null for null country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
});

test('shippingFee: returns null for undefined country', () => {
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});

// Ireland shipping fee tests
test('shippingFee: returns 5 for Ireland non-member with subtotal < 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 50, country: 'IE' }), 5);
  assert.equal(shippingFee({ subtotal: 99, country: 'IE' }), 5);
});

test('shippingFee: returns 2.5 for Ireland member with subtotal < 100', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 50, member: true, country: 'IE' }), 2.5);
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'IE' }), 2.5);
});

// GB shipping fee tests
test('shippingFee: returns 10 for GB non-member with subtotal < 100', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 50, country: 'GB' }), 10);
  assert.equal(shippingFee({ subtotal: 99, country: 'GB' }), 10);
});

test('shippingFee: returns 5 for GB member with subtotal < 100', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
  assert.equal(shippingFee({ subtotal: 50, member: true, country: 'GB' }), 5);
  assert.equal(shippingFee({ subtotal: 99, member: true, country: 'GB' }), 5);
});

// Free shipping when subtotal >= 100 tests
test('shippingFee: returns 0 for Ireland when subtotal >= 100', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 1000, country: 'IE' }), 0);
});

test('shippingFee: returns 0 for GB when subtotal >= 100', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 1000, country: 'GB' }), 0);
});

test('shippingFee: free shipping applies regardless of member status when subtotal >= 100', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: false, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

// Country normalization in shippingFee
test('shippingFee: normalizes country case', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'Ie' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
  assert.equal(shippingFee({ subtotal: 20, country: 'Gb' }), 10);
});

test('shippingFee: normalizes country with whitespace', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' IE ' }), 5);
  assert.equal(shippingFee({ subtotal: 20, country: ' GB ' }), 10);
});

// Member flag default behavior
test('shippingFee: member flag defaults to false', () => {
  const feeWithoutMember = shippingFee({ subtotal: 20, country: 'IE' });
  const feeWithMemberFalse = shippingFee({ subtotal: 20, member: false, country: 'IE' });
  assert.equal(feeWithoutMember, feeWithMemberFalse);
});

// Edge case: subtotal boundary at exactly 100
test('shippingFee: subtotal exactly 100 returns 0', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});
