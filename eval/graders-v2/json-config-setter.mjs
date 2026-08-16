#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootAt = process.argv.indexOf('--root');
const root = rootAt >= 0 ? path.resolve(process.argv[rootAt + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node json-config-setter.mjs --root <workspace>');
  process.exit(2);
}
const assertions = [];
const add = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const cli = path.join(root, 'src', 'cli.js');
const ids = ['dry-run-contract', 'apply-idempotent', 'stream-contract', 'error-contract', 'help-and-tests'];
if (!fs.existsSync(cli)) {
  for (const id of ids) add(id, false, 'src/cli.js is missing');
} else {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'config-set-eval-'));
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8', timeout: 10_000 });
  try {
    const config = path.join(temp, 'settings.json');
    fs.writeFileSync(config, JSON.stringify({ service: { retries: 2 }, untouched: true }, null, 2) + '\n');
    const before = fs.readFileSync(config, 'utf8');
    const preview = run('set', config, 'service.retries', '5', '--dry-run');
    let previewJson;
    try { previewJson = JSON.parse(preview.stdout); } catch {}
    add('dry-run-contract', preview.status === 0 && fs.readFileSync(config, 'utf8') === before && previewJson?.changed === true && previewJson?.value === 5,
      `exit=${preview.status}; unchanged=${fs.readFileSync(config, 'utf8') === before}; stdout=${JSON.stringify(preview.stdout.slice(0, 300))}`);

    const first = run('set', config, 'service.retries', '5');
    const afterFirst = fs.readFileSync(config, 'utf8');
    const second = run('set', config, 'service.retries', '5');
    const parsed = JSON.parse(fs.readFileSync(config, 'utf8'));
    add('apply-idempotent', first.status === 0 && second.status === 0 && parsed.service?.retries === 5 && parsed.untouched === true && fs.readFileSync(config, 'utf8') === afterFirst,
      `first=${first.status}; second=${second.status}; value=${parsed.service?.retries}; stable=${fs.readFileSync(config, 'utf8') === afterFirst}`);
    let firstJson;
    try { firstJson = JSON.parse(first.stdout); } catch {}
    add('stream-contract', Boolean(firstJson) && first.stderr === '' && first.stdout.trim().split(/\r?\n/).length === 1,
      `stdout=${JSON.stringify(first.stdout.slice(0, 300))}; stderr=${JSON.stringify(first.stderr.slice(0, 300))}`);

    const malformed = path.join(temp, 'malformed.json');
    fs.writeFileSync(malformed, '{ nope');
    const bad = run('set', malformed, 'service.retries', '5');
    add('error-contract', bad.status !== 0 && bad.stdout.trim() === '' && /json|parse|malformed|invalid/i.test(bad.stderr),
      `exit=${bad.status}; stdoutBytes=${bad.stdout.length}; stderr=${JSON.stringify(bad.stderr.slice(0, 300))}`);

    const help = run('--help');
    const pkgPath = path.join(root, 'package.json');
    let testCommand;
    try { testCommand = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts?.test; } catch {}
    const tests = !testCommand ? null : process.platform === 'win32'
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd: root, encoding: 'utf8', timeout: 30_000 })
      : spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
    add('help-and-tests', help.status === 0 && /usage|config-set|dotted-key/i.test(help.stdout + help.stderr) && tests?.status === 0,
      `help=${help.status}; tests=${tests?.status ?? 'missing'}`);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
console.log(JSON.stringify({ schemaVersion: 2, caseId: 'json-config-setter', assertions }, null, 2));
process.exit(assertions.some((item) => item.status === 'fail') ? 1 : 0);
