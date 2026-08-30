'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const cli = path.join(__dirname, '..', 'src', 'cli.js');

test('calculates row count and numeric-column means', () => {
  const result = execFileSync(process.execPath, [cli, path.join(__dirname, '..', 'sample.csv')], { encoding: 'utf8' });
  assert.deepEqual(JSON.parse(result), { rowCount: 3, means: { incidents: 4, response_minutes: 15 } });
});

test('supports quoted commas and CRLF input', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'csv-cli-')), 'data.csv');
  fs.writeFileSync(file, 'name,value,other\r\n"A, one",2,x\r\nB,4,y\r\n');
  assert.deepEqual(cli && require('../src/cli').analyze(fs.readFileSync(file, 'utf8')), { rowCount: 2, means: { value: 3 } });
});
