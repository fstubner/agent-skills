'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parseArgs, updateConfig } = require('../src/cli');

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'config-set-'));
  const file = path.join(dir, 'config.json');
  await fs.writeFile(file, '{\n  "server": {\n    "port": 80\n  }\n}\n');
  return { dir, file };
}

test('sets nested JSON values and creates missing objects', async () => {
  const { file } = await fixture();
  await updateConfig({ file, dottedKey: 'server.host.name', parts: ['server', 'host', 'name'], value: 'localhost', dryRun: false });
  assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')), { server: { port: 80, host: { name: 'localhost' } } });
});

test('dry-run does not change the file and is repeatable', async () => {
  const { file } = await fixture();
  const before = await fs.readFile(file, 'utf8');
  const args = { file, dottedKey: 'server.port', parts: ['server', 'port'], value: 443, dryRun: true };
  assert.equal((await updateConfig(args)).dryRun, true);
  assert.equal(await fs.readFile(file, 'utf8'), before);
  assert.equal((await updateConfig({ ...args, dryRun: false })).changed, true);
  assert.equal((await updateConfig({ ...args, dryRun: false })).changed, false);
});

test('rejects invalid JSON documents and values', async () => {
  const { file } = await fixture();
  assert.throws(() => parseArgs(['set', file, 'server.port', 'not-json']), /json-value must be valid JSON/);
  await fs.writeFile(file, '{bad');
  await assert.rejects(() => updateConfig({ file, dottedKey: 'server.port', parts: ['server', 'port'], value: 1, dryRun: true }), /Invalid JSON/);
});
