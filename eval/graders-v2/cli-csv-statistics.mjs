#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const rootArg = process.argv.indexOf('--root');
const root = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node cli-csv-statistics.mjs --root <workspace>');
  process.exit(2);
}

const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const cli = path.join(root, 'src', 'cli.js');
if (!fs.existsSync(cli)) {
  for (const id of ['valid-output', 'bad-input-contract', 'help-contract', 'tests-run']) record(id, false, 'src/cli.js is missing');
} else {
  const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-eval-'));
  try {
    const valid = path.join(probeDir, 'unseen.csv');
    fs.writeFileSync(valid, 'name,count,latency\na,2,10\nb,4,20\nc,6,30\n');
    const good = spawnSync(process.execPath, [cli, valid], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    let parsed = null;
    try { parsed = JSON.parse(good.stdout); } catch { /* recorded below */ }
    const means = parsed?.averages || parsed?.means || parsed;
    const validPass = good.status === 0 && parsed?.rowCount === 3 && means?.count === 4 && means?.latency === 20;
    record('valid-output', validPass,
      `exit=${good.status}; stdout=${JSON.stringify(good.stdout.slice(0, 300))}; expected rowCount=3,count=4,latency=20`);

    const bad = path.join(probeDir, 'bad.csv');
    fs.writeFileSync(bad, 'name,count\na,"unterminated\n');
    const badRun = spawnSync(process.execPath, [cli, bad], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    record('bad-input-contract', badRun.status !== 0 && badRun.stdout.trim() === '' && badRun.stderr.trim() !== '',
      `exit=${badRun.status}; stdoutBytes=${badRun.stdout.length}; stderrBytes=${badRun.stderr.length}`);

    const help = spawnSync(process.execPath, [cli, '--help'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    record('help-contract', help.status === 0 && /usage|csv|statistics/i.test(help.stdout + help.stderr),
      `exit=${help.status}; output=${JSON.stringify((help.stdout + help.stderr).slice(0, 300))}`);

    const pkgPath = path.join(root, 'package.json');
    let testCommand = null;
    try { testCommand = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).scripts?.test; } catch { /* recorded below */ }
    const testRun = !testCommand ? null : process.platform === 'win32'
      ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd: root, encoding: 'utf8', timeout: 30_000 })
      : spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
    record('tests-run', Boolean(testRun) && testRun.status === 0,
      testRun ? `command=${testCommand}; exit=${testRun.status}; output=${JSON.stringify(((testRun.stdout || '') + (testRun.stderr || '')).slice(0, 400))}` : 'package.json scripts.test is missing or unreadable');
  } finally {
    fs.rmSync(probeDir, { recursive: true, force: true });
  }
}

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'cli-csv-statistics', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
