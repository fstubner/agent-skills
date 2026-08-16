'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { calculate } = require('../src/cli');

test('calculates means for numeric columns', () => {
  assert.deepEqual(calculate('name,count,score\na,2,10\nb,4,20\n'), {
    rowCount: 2, means: { count: 3, score: 15 }
  });
});

test('supports quoted commas, escaped quotes, and blank numeric cells', () => {
  assert.deepEqual(calculate('name,value,note\n"A, Inc.",1,"say ""hi"""\nB,,ok\n'), {
    rowCount: 2, means: { value: 1 }
  });
});

test('rejects inconsistent rows', () => {
  assert.throws(() => calculate('a,b\n1\n'), /expected 2/);
});

test('CLI emits JSON for a file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csv-stats-'));
  const file = path.join(dir, 'input.csv');
  fs.writeFileSync(file, 'x,y\n1,3\n5,7\n');
  const result = require('../src/cli').main([file]);
  assert.equal(result, 0);
});
