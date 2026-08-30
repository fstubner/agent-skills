'use strict';

const assert = require('assert');
const { calculate, parseCsv } = require('../src/cli');

assert.deepStrictEqual(calculate('name,count,rate\na,2,1.5\nb,4,2.5\n'), {
  rowCount: 2, count: 3, rate: 2
});
assert.deepStrictEqual(calculate('label,value\n"a,b",10\n"line\ntext",\n'), {
  rowCount: 2, value: 10
});
assert.deepStrictEqual(parseCsv('a,b\n1,2\n'), [['a', 'b'], ['1', '2']]);
assert.throws(() => calculate('a\n"unfinished'), /unterminated/);

console.log('cli tests passed');
