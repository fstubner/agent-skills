import { test } from 'node:test';
import assert from 'node:assert';
import { recordCount, listCounts, clearCounts } from '../src/counts.js';

test('a count is recorded against the person who made it', () => {
  const count = recordCount('s1', 'SKU-1', 12);
  assert.equal(count.staffId, 's1');
  assert.ok(listCounts().some((c) => c.id === count.id));
  clearCounts();
});
