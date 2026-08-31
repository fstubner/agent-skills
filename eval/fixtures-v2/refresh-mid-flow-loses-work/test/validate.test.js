import { test } from 'node:test';
import assert from 'node:assert';
import { validateFault } from '../src/validate.js';

test('a complete report passes', () => {
  assert.deepEqual(validateFault({ property: 'p1', room: 'kitchen', urgency: 'urgent', description: 'tap dripping' }), []);
});

test('a missing property is rejected', () => {
  assert.ok(validateFault({ room: 'kitchen', urgency: 'urgent', description: 'x' })[0].includes('property'));
});

test('an unknown urgency is rejected', () => {
  assert.ok(validateFault({ property: 'p1', room: 'kitchen', urgency: 'whenever', description: 'x' })[0].includes('urgency'));
});
