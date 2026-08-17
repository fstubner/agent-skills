'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const cli = path.join(__dirname, '..', 'src', 'cli.js');
function run(args, cwd) { return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' }); }
function fixture(data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, JSON.stringify(data));
  return { dir, file };
}

test('sets nested JSON and is safe to repeat', () => {
  const { dir, file } = fixture({ server: { port: 80 } });
  let result = run(['set', file, 'server.port', '8080'], dir);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)), { server: { port: 8080 } });
  result = run(['set', file, 'server.port', '8080'], dir);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { server: { port: 8080 } });
});

test('dry-run prints changes without writing', () => {
  const { dir, file } = fixture({ feature: { enabled: false } });
  const before = fs.readFileSync(file, 'utf8');
  const result = run(['set', '--dry-run', file, 'feature.enabled', 'true'], dir);
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), { feature: { enabled: true } });
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('--help and errors use the correct streams', () => {
  const help = run(['--help'], process.cwd());
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Usage:/);
  const bad = run(['set'], process.cwd());
  assert.equal(bad.status, 1);
  assert.equal(bad.stdout, '');
  assert.match(bad.stderr, /Error:/);
});
