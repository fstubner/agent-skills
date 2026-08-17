'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const test = require('node:test');

const cli = path.resolve(__dirname, '..', 'src', 'cli.js');

function fixture(contents) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, contents);
  return file;
}

test('sets nested values and is safe to repeat', () => {
  const file = fixture('{"service":{"retries":2}}\n');
  const expected = { service: { retries: 3 } };
  const first = JSON.parse(execFileSync(process.execPath, [cli, 'set', file, 'service.retries', '3'], { encoding: 'utf8' }));
  const second = JSON.parse(execFileSync(process.execPath, [cli, 'set', file, 'service.retries', '3'], { encoding: 'utf8' }));
  assert.deepEqual(first, expected);
  assert.deepEqual(second, expected);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), expected);
});

test('dry-run emits JSON without writing', () => {
  const file = fixture('{"a":{}}\n');
  const result = spawnSync(process.execPath, [cli, 'set', '--dry-run', file, 'a.b', 'true'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { a: { b: true } });
  assert.equal(fs.readFileSync(file, 'utf8'), '{"a":{}}\n');
  assert.equal(result.stderr, '');
});

test('--help is accurate and errors use stderr', () => {
  const help = execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.match(help, /config-set set/);
  const result = spawnSync(process.execPath, [cli, 'set', 'missing.json', 'a', 'nope'], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Error:/);
});
