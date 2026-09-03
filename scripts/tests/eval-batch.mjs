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

function bundle(name, exitCode, grading) {
  const dir = path.join(runsDir, name);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify({
    runId: name,
    caseId,
    condition: 'control',
    harness,
    model,
    exitCode,
    graderSha256: sha256(fs.readFileSync(path.join(root, testCase.grader))),
    grading,
  }));
}
// One usable trial, and the two kinds of bundle that are not one.
bundle(`${caseId}-${harness}-control-real`, 0, { passed: 2, failed: 3, notEvaluated: 0, total: 5 });
// The 429 shape: nothing evaluated, no model turn.
bundle(`${caseId}-${harness}-control-empty`, 1, { passed: 0, failed: 0, notEvaluated: 5, total: 5 });
// The truncation shape, and the harder of the two to spot: a full grading off
// incomplete output. "API Error: Server error mid-response" exits non-zero
// with tokens billed, and the assertions score against an answer that was cut
// off. eval-report excludes it; counting it here reported two cases complete
// at 14 of 15 trials.
bundle(`${caseId}-${harness}-control-truncated`, 1, { passed: 2, failed: 9, notEvaluated: 0, total: 11 });
// Exit 0 and nothing evaluated: the contamination shape, where eval-run.mjs
// finds a control arm reading an ambient installed skill and voids the run
// while the harness itself succeeded. Without this the notEvaluated half of
// the rule is untested — the two bundles above both exit non-zero, so the
// exitCode check alone would catch them and the check would look load-bearing
// when it is not.
bundle(`${caseId}-${harness}-control-void`, 0, { passed: 0, failed: 0, notEvaluated: 5, total: 5 });

const r = spawnSync(process.execPath, [
  path.join(root, 'scripts', 'eval-batch.mjs'),
  '--case', caseId, '--harness', harness, '--runs-dir', runsDir, '--dry-run',
], { cwd: root, encoding: 'utf8' });

const trials = evidence.minimumEvidence.trialsPerCondition;
const conditions = testCase.conditions.length;
// Every condition of the case is short by `trials`, except control, which has
// exactly one usable trial. Neither the empty nor the truncated bundle counts.
const wantOutstanding = trials * conditions - 1;
const reported = /(\d+) runs outstanding/.exec(r.stdout);
expect('eval-batch --dry-run reports an outstanding count', Boolean(reported), r.stdout || r.stderr);
expect('only a run eval-report can use fills a cell',
  reported && Number(reported[1]) === wantOutstanding,
  `wanted ${wantOutstanding} outstanding, got ${reported?.[1]}: ${r.stdout}`);
