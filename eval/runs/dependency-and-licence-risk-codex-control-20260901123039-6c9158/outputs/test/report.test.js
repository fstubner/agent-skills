import { test } from 'node:test';
import assert from 'node:assert';
import { buildReport } from '../src/report.js';

test('rows are sorted by total ascending', () => {
  const out = buildReport([{ name: 'b', total: 5 }, { name: 'a', total: 2 }]);
  assert.equal(out, 'a,2\nb,5');
});
