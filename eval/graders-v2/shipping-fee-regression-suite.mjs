#!/usr/bin/env node
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const rootAt = process.argv.indexOf('--root');
const root = rootAt >= 0 ? path.resolve(process.argv[rootAt + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node shipping-fee-regression-suite.mjs --root <workspace>');
  process.exit(2);
}
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const runTests = (cwd) => process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd, encoding: 'utf8', timeout: 30_000 })
  : spawnSync('npm', ['test'], { cwd, encoding: 'utf8', timeout: 30_000 });
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'shipping-eval-'));

function scenario(name, mutate) {
  const workspace = path.join(tempRoot, name);
  fs.cpSync(root, workspace, { recursive: true });
  const sourcePath = path.join(workspace, 'src', 'shipping-fee.js');
  const before = fs.readFileSync(sourcePath, 'utf8');
  const after = mutate(before);
  if (after === before) return { changed: false, status: null, output: 'mutation sentinel was absent' };
  fs.writeFileSync(sourcePath, after);
  const result = runTests(workspace);
  return { changed: true, status: result.status, output: ((result.stdout || '') + (result.stderr || '')).slice(0, 300) };
}

try {
  const baselineRuns = Array.from({ length: 6 }, () => runTests(root));
  record('stable-baseline', baselineRuns.every((run) => run.status === 0), `exits=${baselineRuns.map((run) => run.status).join(',')}`);

  const rename = scenario('private-rename', (source) => source.replaceAll('_normalizeCountry', '_canonicalCountry'));
  record('public-behavior', rename.changed && rename.status === 0, `changed=${rename.changed}; exit=${rename.status}; output=${JSON.stringify(rename.output)}`);

  const threshold = scenario('threshold-mutant', (source) => source.replace('if (subtotal >= 100) return 0;', 'if (subtotal > 100) return 0;'));
  record('kills-threshold-mutant', threshold.changed && threshold.status !== 0, `changed=${threshold.changed}; exit=${threshold.status}`);

  const unsupported = scenario('unsupported-mutant', (source) => source.replace("if (!['IE', 'GB'].includes(normalized)) return null;", "if (!['IE', 'GB'].includes(normalized)) return 0;"));
  record('kills-unsupported-mutant', unsupported.changed && unsupported.status !== 0, `changed=${unsupported.changed}; exit=${unsupported.status}`);

  const member = scenario('member-mutant', (source) => source.replace('return member ? base / 2 : base;', 'return base;'));
  record('kills-member-mutant', member.changed && member.status !== 0, `changed=${member.changed}; exit=${member.status}`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'shipping-fee-regression-suite', assertions }, null, 2));
process.exit(assertions.some((item) => item.status === 'fail') ? 1 : 0);
