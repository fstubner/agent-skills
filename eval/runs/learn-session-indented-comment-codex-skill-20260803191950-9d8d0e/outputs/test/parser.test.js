import test from 'node:test';
import assert from 'node:assert/strict';
import { isComment } from '../src/parser.js';

test('recognizes a comment marker', () => {
  assert.equal(isComment('# note'), true);
  assert.equal(isComment('value'), false);
});

test('recognizes comments after leading whitespace', () => {
  assert.equal(isComment('  # retired account'), true);
});
