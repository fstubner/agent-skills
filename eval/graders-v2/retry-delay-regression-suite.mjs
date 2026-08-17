#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootAt = process.argv.indexOf('--root');
const root = rootAt >= 0 ? path.resolve(process.argv[rootAt + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node retry-delay-regression-suite.mjs --root <workspace>');
  process.exit(2);
}
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const runTests = (cwd) => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--test', path.join(cwd, 'test', 'retry-delay.test.js')], { cwd, env, encoding: 'utf8', timeout: 30_000 });
};
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'retry-delay-eval-'));

function scenario(name, mutate) {
  const workspace = path.join(tempRoot, name);
  fs.cpSync(root, workspace, { recursive: true });
  const sourcePath = path.join(workspace, 'src', 'retry-delay.js');
  const before = fs.readFileSync(sourcePath, 'utf8');
  const after = mutate(before);
  if (after === before) return { changed: false, status: null };
  fs.writeFileSync(sourcePath, after);
  return { changed: true, status: runTests(workspace).status };
}

try {
  const baseline = Array.from({ length: 6 }, () => runTests(root));
  record('stable-baseline', baseline.every((run) => run.status === 0), `exits=${baseline.map((run) => run.status).join(',')}`);
  const rename = scenario('private-rename', (source) => source.replaceAll('_asRetryAfter', '_normalizeRetryAfter'));
  record('public-behavior', rename.changed && rename.status === 0, `changed=${rename.changed}; exit=${rename.status}`);
  const cap = scenario('cap-mutant', (source) => source.replace('Math.min(value, 30_000)', 'value'));
  record('kills-cap-mutant', cap.changed && cap.status !== 0, `changed=${cap.changed}; exit=${cap.status}`);
  const nonretryable = scenario('nonretryable-mutant', (source) => source.replace(/\n  return null;\n}\s*$/, '\n  return 250;\n}'));
  record('kills-nonretryable-mutant', nonretryable.changed && nonretryable.status !== 0, `changed=${nonretryable.changed}; exit=${nonretryable.status}`);
  const validation = scenario('validation-mutant', (source) => source.replace("if (!Number.isInteger(attempt) || attempt < 1) throw new TypeError('attempt must be a positive integer');", 'if (attempt < 0) throw new TypeError(\'attempt must be a positive integer\');'));
  record('kills-validation-mutant', validation.changed && validation.status !== 0, `changed=${validation.changed}; exit=${validation.status}`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'retry-delay-regression-suite', assertions }, null, 2));
process.exit(assertions.some((item) => item.status === 'fail') ? 1 : 0);
