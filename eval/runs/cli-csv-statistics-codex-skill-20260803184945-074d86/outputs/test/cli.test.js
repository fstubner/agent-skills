'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { analyze, parseCsv } = require('../src/cli');

assert.deepEqual(analyze(fs.readFileSync(path.join(__dirname, '..', 'sample.csv'), 'utf8')), {
  rowCount: 3,
  means: { incidents: 4, response_minutes: 15 },
});
assert.deepEqual(analyze('name,value\n"A, Inc.",2\nB,4\n'), { rowCount: 2, means: { value: 3 } });
assert.deepEqual(parseCsv('a,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
assert.throws(() => parseCsv('a\n"unterminated'), /unterminated/);

const missing = path.join(os.tmpdir(), `csv-cli-missing-${process.pid}.csv`);
assert.equal(fs.existsSync(missing), false);
console.log('CLI tests passed');
