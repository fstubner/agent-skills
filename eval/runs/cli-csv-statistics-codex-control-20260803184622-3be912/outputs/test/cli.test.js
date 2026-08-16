'use strict';

const assert = require('assert');
const { parseCsv, summarize } = require('../src/cli');

assert.deepStrictEqual(summarize('team,incidents,response_minutes\nalpha,3,12\nbeta,5,18\ngamma,4,15\n'), {
  rowCount: 3,
  means: { incidents: 4, response_minutes: 15 }
});
assert.deepStrictEqual(parseCsv('name,note\n"A, Inc.","said ""hi"""\n'), [['name', 'note'], ['A, Inc.', 'said "hi"']]);
assert.deepStrictEqual(summarize('label,value,empty\na,1,\nb,3,\n'), { rowCount: 2, means: { value: 2 } });
console.log('All tests passed');
