'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const cli = path.resolve(__dirname, '../src/cli.js');
function run(args, cwd) { return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' }); }
function fixture(value) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-')); const file = path.join(dir, 'config.json'); fs.writeFileSync(file, JSON.stringify(value)); return { dir, file }; }

test('sets nested JSON values and is safe to repeat', () => {
  const { dir, file } = fixture({ service: { port: 80 } });
  let result = run(['set', file, 'service.port', '8080'], dir);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), { service: { port: 8080 } });
  result = run(['set', file, 'service.port', '8080'], dir);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { service: { port: 8080 } });
});

test('dry-run reports changes without writing', () => {
  const { dir, file } = fixture({});
  const before = fs.readFileSync(file, 'utf8');
  const result = run(['set', '--dry-run', file, 'a.b', 'true'], dir);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { a: { b: true } });
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('invalid input goes to stderr and leaves file unchanged', () => {
  const { dir, file } = fixture({ a: 1 });
  const result = run(['set', file, 'a.b', '{bad'], dir);
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /json-value is not valid JSON/);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), { a: 1 });
});
