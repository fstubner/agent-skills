import { test } from 'node:test';
import assert from 'node:assert';
import { submit, claimsFor } from '../src/claims.js';

test('a submitted claim is listed for the person who submitted it', () => {
  const claim = submit('s1', { amountMinor: 4250, category: 'travel', spentOn: '2026-08-03' });
  assert.equal(claim.status, 'submitted');
  assert.ok(claimsFor('s1').some((c) => c.id === claim.id));
});
