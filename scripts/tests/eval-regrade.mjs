// eval-regrade must not score a run that produced no model output.
//
// The failure this pins was observed, not imagined. Before the eligibility
// filter existed, regrading `narrowed-audit-across-a-trust-boundary` reported
// 9 extra bundles in which every assertion "failed" — they were 429 runs whose
// workspace the model never touched, and whose recorded grading was entirely
// not_evaluated. A rubric repair judged against that table would conclude a
// brand-new assertion discriminates beautifully when nothing had run at all.
import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert';
import { spawnSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'regrade-'));

const grader = path.join(tmp, 'grader.mjs');
fs.writeFileSync(grader, `
const root = process.argv[process.argv.indexOf('--root') + 1];
const fs = await import('fs');
const wrote = fs.existsSync(root + '/REPORT.md');
console.log(JSON.stringify({ schemaVersion: 2, caseId: 'tc', assertions: [
  { id: 'report-written', status: wrote ? 'pass' : 'fail', evidence: '' },
] }));
`);

fs.mkdirSync(path.join(tmp, 'cases-v2'), { recursive: true });
fs.writeFileSync(path.join(tmp, 'cases-v2', 'tc.json'), JSON.stringify({
  id: 'tc', skill: 'x', grader: path.relative(root, grader).split(path.sep).join('/'),
  assertions: [{ id: 'report-written' }],
}));

function bundle(name, manifest, { wroteReport }) {
  const dir = path.join(tmp, 'runs', name);
  fs.mkdirSync(path.join(dir, 'outputs'), { recursive: true });
  if (wroteReport) fs.writeFileSync(path.join(dir, 'outputs', 'REPORT.md'), '# report\n');
  fs.writeFileSync(path.join(dir, 'transcript.jsonl'), '');
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
    caseId: 'tc', condition: 'control', harness: 'claude-code', totalTokens: 10, costUsd: 0.01,
    exitCode: 0, grading: { notEvaluated: 0 }, ...manifest,
  }));
}

// One real run, and two that must never reach the grader.
bundle('good', {}, { wroteReport: true });
bundle('quota-exhausted', { grading: { notEvaluated: 1 } }, { wroteReport: false });
bundle('truncated', { exitCode: 1 }, { wroteReport: false });

const r = spawnSync(process.execPath,
  [path.join(root, 'scripts', 'eval-regrade.mjs'), '--case', 'tc', '--eval-root', tmp, '--json'],
  { encoding: 'utf8' });
assert.strictEqual(r.status, 0, r.stderr);
const out = JSON.parse(r.stdout);

assert.strictEqual(out.scored, 1, `expected only the eligible bundle to be scored, got ${out.scored}`);
assert.strictEqual(out.skipped.length, 2, 'both ineligible bundles must be reported, not silently dropped');
assert.deepStrictEqual(out.skipped.map((s) => s.dir).sort(), ['quota-exhausted', 'truncated']);

// And the consequence that matters: with the two excluded, the assertion is
// seen to always pass. Counting them would have shown it "discriminating".
assert.strictEqual(out.table[0].verdict, 'ALWAYS PASSES');
assert.strictEqual(out.table[0].discriminates, false);

fs.rmSync(tmp, { recursive: true, force: true });
console.log('eval-regrade: ineligible runs excluded from scoring');
