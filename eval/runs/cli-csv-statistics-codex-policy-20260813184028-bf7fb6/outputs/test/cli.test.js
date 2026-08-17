'use strict';

const assert = require('assert');
const { parseCsv, summarizeCsv } = require('../src/cli');

assert.deepStrictEqual(summarizeCsv('team,incidents,response_minutes\nalpha,3,12\nbeta,5,18\ngamma,4,15\n'), {
  rowCount: 3,
  means: { incidents: 4, response_minutes: 15 },
});
assert.deepStrictEqual(summarizeCsv('name,value,note\n"A, Inc.",1,"hello ""world"""\nB,3,x\n'), {
  rowCount: 2,
  means: { value: 2 },
});
assert.deepStrictEqual(summarizeCsv('a,b\n1,\n2,\n'), { rowCount: 2, means: { a: 1.5 } });
assert.deepStrictEqual(parseCsv(''), []);
assert.throws(() => summarizeCsv('a,b\n1\n'), /different number/);
assert.throws(() => summarizeCsv('a,b\n"1,2\n'), /unterminated/);

console.log('CLI tests passed');
