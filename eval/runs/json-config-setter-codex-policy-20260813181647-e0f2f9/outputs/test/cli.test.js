'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile } = require('node:fs').promises;
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const cli = path.resolve(__dirname, '../src/cli.js');
async function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args]); let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += d; }); child.stderr.on('data', (d) => { err += d; });
    child.on('close', (code) => resolve({ code, out, err }));
  });
}

test('sets nested values atomically and is repeatable', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'config-set-')); const file = path.join(dir, 'config.json');
  await writeFile(file, '{"server":{"port":80}}\n');
  let result = await run(['set', file, 'server.port', '8080']);
  assert.equal(result.code, 0); assert.equal(JSON.parse(await readFile(file, 'utf8')).server.port, 8080);
  result = await run(['set', file, 'server.port', '8080']);
  assert.equal(JSON.parse(result.out).changed, false);
});

test('dry-run prints result without writing', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'config-set-')); const file = path.join(dir, 'config.json');
  await writeFile(file, '{}\n'); const before = await readFile(file, 'utf8');
  const result = await run(['set', '--dry-run', file, 'a.b', '[1,2]']);
  assert.equal(result.code, 0); assert.deepEqual(JSON.parse(result.out).config, { a: { b: [1, 2] } });
  assert.equal(await readFile(file, 'utf8'), before);
});

test('rejects invalid input and keeps diagnostics off stdout', async () => {
  const result = await run(['set', '/missing', 'a', '{']);
  assert.notEqual(result.code, 0); assert.equal(result.out, ''); assert.match(result.err, /valid JSON/);
});
