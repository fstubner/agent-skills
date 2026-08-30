'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../src/cli.js');
function run(file, ...args) { return execFileSync(process.execPath, [cli, ...args, file], { encoding: 'utf8' }); }

test('sets nested JSON values and is idempotent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, '{"service":{"retries":2}}\n');
  execFileSync(process.execPath, [cli, 'set', file, 'service.retries', '3']);
  assert.equal(JSON.parse(fs.readFileSync(file)).service.retries, 3);
  const before = fs.readFileSync(file);
  execFileSync(process.execPath, [cli, 'set', file, 'service.retries', '3']);
  assert.deepEqual(fs.readFileSync(file), before);
});

test('dry-run does not write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, '{}\n');
  execFileSync(process.execPath, [cli, 'set', file, 'new.value', 'true', '--dry-run']);
  assert.equal(fs.readFileSync(file, 'utf8'), '{}\n');
});
