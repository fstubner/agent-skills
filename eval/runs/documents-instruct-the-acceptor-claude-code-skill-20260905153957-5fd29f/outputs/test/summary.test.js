import { test } from 'node:test';
import assert from 'node:assert';
import { boardSummary } from '../src/summary.js';

test('the banner counts the open swaps', () => {
  const summary = boardSummary([{ startsWithinHours: 6 }, { startsWithinHours: 40 }]);
  assert.ok(summary.headline.includes('2 shifts'));
  assert.equal(summary.urgent, 1);
});
