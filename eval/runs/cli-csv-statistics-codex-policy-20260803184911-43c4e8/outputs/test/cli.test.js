const test = require('node:test');
const assert = require('node:assert/strict');
const { analyzeCsv } = require('../src/cli');

test('counts rows and averages every numeric column', () => {
  assert.deepEqual(analyzeCsv('team,incidents,response_minutes\nalpha,3,12\nbeta,5,18\ngamma,4,15\n'), {
    rowCount: 3, incidents: 4, response_minutes: 15
  });
});

test('supports quoted fields and unseen columns', () => {
  assert.deepEqual(analyzeCsv('name,score,notes\n"A, Inc",2,"ok"\nB,4,done'), {
    rowCount: 2, score: 3
  });
});

test('rejects malformed row widths', () => {
  assert.throws(() => analyzeCsv('a,b\n1'), /wrong number/);
});

test('rejects an empty CSV', () => {
  assert.throws(() => analyzeCsv(''), /empty/);
});
