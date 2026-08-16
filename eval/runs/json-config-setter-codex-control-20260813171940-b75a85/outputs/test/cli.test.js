'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const cli = path.join(__dirname, '..', 'src', 'cli.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-'));
const file = path.join(dir, 'config.json');
fs.writeFileSync(file, '{"server":{"host":"localhost"}}\n');

function run(...args) { return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' }); }

let result = run('set', file, 'server.port', '8080');
assert.strictEqual(result.status, 0, result.stderr);
assert.deepStrictEqual(JSON.parse(fs.readFileSync(file)), { server: { host: 'localhost', port: 8080 } });
assert.deepStrictEqual(JSON.parse(result.stdout), { server: { host: 'localhost', port: 8080 } });

const before = fs.readFileSync(file, 'utf8');
result = run('set', '--dry-run', file, 'new.enabled', 'true');
assert.strictEqual(result.status, 0, result.stderr);
assert.deepStrictEqual(JSON.parse(result.stdout).new, { enabled: true });
assert.strictEqual(fs.readFileSync(file, 'utf8'), before);

result = run('--help');
assert.strictEqual(result.status, 0);
assert.match(result.stdout, /--dry-run/);
assert.match(result.stdout, /<dotted-key>/);

result = run('set', file, 'server.port', '8080');
assert.strictEqual(result.status, 0, result.stderr);
assert.strictEqual(JSON.parse(fs.readFileSync(file)).server.port, 8080);

result = run('set', file, 'server.port', 'not-json');
assert.notStrictEqual(result.status, 0);
assert.match(result.stderr, /not valid JSON/);

console.log('CLI tests passed');
