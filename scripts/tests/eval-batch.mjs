// The batch runner must not count a harness failure as a trial.
//
// On 2026-09-02 the claude-code session limit tripped mid-batch. eval-run.mjs
// did its job — every assertion in every affected bundle was marked
// not_evaluated with the 429 text as evidence — and eval-report did its job
// and excluded them. eval-batch counted them as filled cells. It reported
// "completed 100, failed 0" for a batch in which nothing ran, then reported
// the arm complete with 0 outstanding when 158 cells were still short.
//
// The runner is exercised against a temporary runs directory: one real
// bundle and one empty one for the same cell, both bound to the current
// grader. The cell needs three trials; the empty bundle must not count, so
// two remain outstanding, not one.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { expect, tmpBase } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const evidence = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8'));
const caseId = 'rollback-by-recollection';
const testCase = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', `${caseId}.json`), 'utf8'));
const harness = 'claude-code';
const model = evidence.minimumEvidence.requiredModelsByHarness[harness][0];

const runsDir = path.join(tmpBase, 'eval-batch-runs');
fs.mkdirSync(runsDir, { recursive: true });

function bundle(name, grading) {
  const dir = path.join(runsDir, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
    runId: name,
    caseId,
    condition: 'control',
    harness,
    model,
    graderSha256: sha256(fs.readFileSync(path.join(root, testCase.grader))),
    grading,
  }));
}
bundle(`${caseId}-${harness}-control-real`, { passed: 2, failed: 3, notEvaluated: 0, total: 5 });
bundle(`${caseId}-${harness}-control-empty`, { passed: 0, failed: 0, notEvaluated: 5, total: 5 });

const r = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'eval-batch.mjs'),
  '--case', caseId, '--harness', harness, '--runs-dir', runsDir, '--dry-run',
], { cwd: root, encoding: 'utf8' });

const trials = evidence.minimumEvidence.trialsPerCondition;
const conditions = testCase.conditions.length;
// Every condition of the case is short by `trials`, except control, which has
// exactly one real trial. The empty bundle changes nothing.
const wantOutstanding = trials * conditions - 1;
const reported = /(\d+) runs outstanding/.exec(r.stdout);
expect('eval-batch --dry-run reports an outstanding count', Boolean(reported), r.stdout || r.stderr);
expect('a bundle with nothing evaluated does not fill a cell',
  reported && Number(reported[1]) === wantOutstanding,
  `wanted ${wantOutstanding} outstanding, got ${reported?.[1]}: ${r.stdout}`);
