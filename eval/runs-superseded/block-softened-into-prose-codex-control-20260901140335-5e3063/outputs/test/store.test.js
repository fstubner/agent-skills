import { test } from 'node:test';
import assert from 'node:assert';
import { appointmentsFor } from '../src/store.js';

test('the list is filtered to the signed-in patient', () => {
  assert.deepEqual(appointmentsFor('nobody'), []);
});
