import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingFee, _normalizeCountry } from '../src/shipping-fee.js';

test('ordinary Irish shipping', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'IE' }), 5);
});

test('normalizes the private country helper', () => {
  assert.equal(_normalizeCountry(' ie '), 'IE');
});

test('returns a result for a member', () => {
  assert.ok(shippingFee({ subtotal: 20, member: true, country: 'IE' }));
});

test('GB ordinary shipping fee', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'GB' }), 10);
});

test('IE member gets 50% discount', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'IE' }), 2.5);
});

test('GB member gets 50% discount', () => {
  assert.equal(shippingFee({ subtotal: 20, member: true, country: 'GB' }), 5);
});

test('free shipping at threshold for IE', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'IE' }), 0);
});

test('free shipping at threshold for GB', () => {
  assert.equal(shippingFee({ subtotal: 100, country: 'GB' }), 0);
});

test('free shipping above threshold for IE', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'IE' }), 0);
});

test('free shipping above threshold for GB', () => {
  assert.equal(shippingFee({ subtotal: 150, country: 'GB' }), 0);
});

test('charges just below threshold for IE', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'IE' }), 5);
});

test('charges just below threshold for GB', () => {
  assert.equal(shippingFee({ subtotal: 99.99, country: 'GB' }), 10);
});

test('unsupported country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'US' }), null);
});

test('null country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: null }), null);
});

test('undefined country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: undefined }), null);
});

test('empty string country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '' }), null);
});

test('whitespace-only country returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: '  ' }), null);
});

test('case-insensitive country handling for IE', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'ie' }), 5);
});

test('case-insensitive country handling for GB', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'gb' }), 10);
});

test('mixed case with whitespace for IE', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' Ie ' }), 5);
});

test('mixed case with whitespace for GB', () => {
  assert.equal(shippingFee({ subtotal: 20, country: ' gB ' }), 10);
});

test('free shipping ignores member status for IE', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'IE' }), 0);
});

test('free shipping ignores member status for GB', () => {
  assert.equal(shippingFee({ subtotal: 100, member: true, country: 'GB' }), 0);
});

test('normalization handles falsy values', () => {
  assert.equal(_normalizeCountry(null), '');
  assert.equal(_normalizeCountry(undefined), '');
  assert.equal(_normalizeCountry(0), '0');
  assert.equal(_normalizeCountry(false), 'FALSE');
});

test('normalization trims and uppercases', () => {
  assert.equal(_normalizeCountry('  gb  '), 'GB');
  assert.equal(_normalizeCountry('\t ie \n'), 'IE');
});

test('non-standard country code returns null', () => {
  assert.equal(shippingFee({ subtotal: 20, country: 'FR' }), null);
});

test('member=false explicitly works', () => {
  assert.equal(shippingFee({ subtotal: 20, member: false, country: 'IE' }), 5);
});

test('default member value is false', () => {
  assert.equal(
    shippingFee({ subtotal: 20, country: 'IE' }),
    shippingFee({ subtotal: 20, member: false, country: 'IE' })
  );
});

test('high decimal subtotal applies fee for IE', () => {
  assert.equal(shippingFee({ subtotal: 99.5, country: 'IE' }), 5);
});

test('high decimal subtotal applies fee for GB', () => {
  assert.equal(shippingFee({ subtotal: 99.5, country: 'GB' }), 10);
});
