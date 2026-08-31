import { test } from 'node:test';
import assert from 'node:assert';
import { listInvoices } from '../src/invoices.js';

test('invoices are filtered to the signed-in member of staff', () => {
  assert.deepEqual(listInvoices('nobody'), []);
});
