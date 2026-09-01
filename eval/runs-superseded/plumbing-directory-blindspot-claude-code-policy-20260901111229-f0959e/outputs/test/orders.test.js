import { test } from 'node:test';
import assert from 'node:assert';
import { formatMinor } from '../src/format.js';

test('minor units render as a decimal amount', () => {
  assert.equal(formatMinor(1234), '12.34');
  assert.equal(formatMinor(5), '0.05');
  assert.equal(formatMinor(-250), '-2.50');
});
