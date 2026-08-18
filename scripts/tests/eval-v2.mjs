import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import { expect, tmpBase } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const node = process.execPath;
const require = createRequire(import.meta.url);
const { validate } = require('../../core/lib/schema.cjs');
const evidenceSchema = JSON.parse(fs.readFileSync(path.join(root, 'core', 'schemas', 'eval-evidence.schema.json'), 'utf8'));
const evidenceContract = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8'));
expect('efficacy promotion contract matches its schema', validate(evidenceSchema, evidenceContract).length === 0);
const weakenedEvidence = structuredClone(evidenceContract);
weakenedEvidence.minimumEvidence.confidenceLevel = 0.8;
expect('efficacy promotion schema rejects weakened confidence (mutation)', validate(evidenceSchema, weakenedEvidence).length > 0);
const verify = spawnSync(node, [path.join(root, 'scripts', 'eval-verify.mjs')], { cwd: root, encoding: 'utf8' });
expect('v2 evaluation evidence verifies', verify.status === 0, verify.stderr || verify.stdout);
const reportRun = spawnSync(node, [path.join(root, 'scripts', 'eval-report.mjs')], { cwd: root, encoding: 'utf8' });
let report = null;
try { report = JSON.parse(reportRun.stdout); } catch { /* assertion reports raw output */ }
expect('v2 report refuses to call an unrun pilot ready', reportRun.status === 0 && report?.skills?.['cli-tooling']?.ready === false, reportRun.stderr || reportRun.stdout);
expect('benchmark report distinguishes harness failures from model outcomes', Array.isArray(report?.ineligibleRuns), reportRun.stderr || reportRun.stdout);

// Every harness/model/condition combination the contract requires, as a flat
// list rather than three levels of nesting at the call site.
function cohortCells(requiredHarnesses, requiredModelsByHarness) {
  const cells = [];
  for (const harness of requiredHarnesses) {
    for (const model of requiredModelsByHarness[harness]) {
      for (const condition of ['control', 'policy', 'skill']) cells.push({ harness, model, condition });
    }
  }
  return cells;
}

function writeSyntheticRun({ runsDir, id, assertions, statuses, harness, model, condition, trial }) {
  const runId = `${id}-${harness}-${model}-${condition}-${trial}`;
  const runDir = path.join(runsDir, runId);
  fs.mkdirSync(runDir, { recursive: true });
  const grading = {
    assertions: assertions.map((assertion, index) => ({
      id: assertion.id,
      status: statuses[index % statuses.length] ? 'pass' : 'fail',
    })),
  };
  fs.writeFileSync(path.join(runDir, 'grading.json'), JSON.stringify(grading));
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({
    runId, caseId: id, condition, harness, model, exitCode: 0,
    durationMs: 1, totalTokens: 100,
    costUsd: null, costCredits: 1,
    grading: { notEvaluated: 0 }, files: { grading: 'grading.json' },
  }));
}

function syntheticReport(name, { caseScores, requiredHarnesses = ['codex'], requiredModelsByHarness = { codex: ['m'] }, omit = () => false }) {
  const syntheticRoot = path.join(tmpBase, `eval-report-${name}`);
  const casesDir = path.join(syntheticRoot, 'cases-v2');
  const runsDir = path.join(syntheticRoot, 'runs');
  fs.mkdirSync(casesDir, { recursive: true });
  fs.mkdirSync(runsDir, { recursive: true });
  fs.writeFileSync(path.join(syntheticRoot, 'evidence.json'), JSON.stringify({
    minimumEvidence: {
      freshCasesPerSkill: caseScores.length,
      trialsPerCondition: 3,
      requiredConditions: ['control', 'policy', 'skill'],
      requiredHarnesses,
      requiredModelsByHarness,
      primaryBaselineCondition: 'policy',
      confidenceLevel: 0.95,
      outcomeDeltaRequired: 0.1,
      efficiencyReductionRequired: 0.1,
      outcomeNonInferiorityMargin: 0.02,
    },
  }));
  for (let caseIndex = 0; caseIndex < caseScores.length; caseIndex++) {
    const id = `case-${caseIndex + 1}`;
    const scores = caseScores[caseIndex];
    const assertionCount = Math.max(...Object.values(scores).map((values) => values.length));
    const assertions = Array.from({ length: assertionCount }, (_, index) => ({ id: `a-${index + 1}`, kind: 'outcome' }));
    fs.writeFileSync(path.join(casesDir, `${id}.json`), JSON.stringify({ id, skill: 'synthetic-skill', conditions: ['control', 'policy', 'skill'], assertions }));
    // Four nested loops reached depth 8 and blocked a commit on this suite's
    // own code-smells gate. The cohort is now enumerated flat and each run
    // written by its own function, which reads better than the nest did.
    for (const cell of cohortCells(requiredHarnesses, requiredModelsByHarness)) {
      if (omit({ caseIndex, ...cell })) continue;
      for (let trial = 1; trial <= 3; trial++) {
        writeSyntheticRun({ runsDir, id, assertions, statuses: scores[cell.condition], ...cell, trial });
      }
    }
  }
  const result = spawnSync(node, [path.join(root, 'scripts', 'eval-report.mjs'), '--eval-root', syntheticRoot], { cwd: root, encoding: 'utf8' });
  try { return { result, report: JSON.parse(result.stdout) }; }
  catch { return { result, report: null }; }
}

const incomplete = syntheticReport('incomplete', {
  caseScores: Array.from({ length: 3 }, () => ({ control: [false], policy: [false], skill: [true] })),
  omit: ({ caseIndex }) => caseIndex > 0,
});
expect('eval report counts completed cases, not merely configured case files',
  incomplete.result.status === 0
    && incomplete.report?.skills?.['synthetic-skill']?.configuredCaseCount === 3
    && incomplete.report?.skills?.['synthetic-skill']?.completedCaseCount === 1
    && incomplete.report?.skills?.['synthetic-skill']?.decision === 'insufficient-evidence',
  incomplete.result.stderr || incomplete.result.stdout);

const missingCohort = syntheticReport('missing-cohort', {
  caseScores: [{ control: [false], policy: [false], skill: [true] }],
  requiredHarnesses: ['claude-code', 'codex'],
  requiredModelsByHarness: { 'claude-code': ['haiku'], codex: ['luna'] },
  omit: ({ harness }) => harness === 'claude-code',
});
expect('eval report requires every declared case/harness/model cohort',
  missingCohort.report?.skills?.['synthetic-skill']?.completedCaseCount === 0
    && missingCohort.report.skills['synthetic-skill'].reasons.some((reason) => reason.includes('claude-code/haiku/control')),
  missingCohort.result.stderr || missingCohort.result.stdout);

const equalWeighting = syntheticReport('equal-weighting', {
  caseScores: [
    { control: [false, false, false, false, false, false, false, false, false, false], policy: [false], skill: [true] },
    { control: [true], policy: [true], skill: [false] },
    { control: [false], policy: [false], skill: [false] },
  ],
});
expect('eval report treats runs and case cohorts as units instead of pooling assertions',
  Math.abs(equalWeighting.report?.skills?.['synthetic-skill']?.outcomeDelta) < 1e-12,
  equalWeighting.result.stderr || equalWeighting.result.stdout);

const fixedBaseline = syntheticReport('fixed-baseline', {
  caseScores: Array.from({ length: 3 }, () => ({ control: [true, true], policy: [false, false], skill: [true, false] })),
});
expect('eval report uses the pre-specified policy baseline instead of the post-hoc best baseline',
  fixedBaseline.report?.skills?.['synthetic-skill']?.outcomeDelta === 0.5
    && fixedBaseline.report.skills['synthetic-skill'].decision === 'quality-winner',
  fixedBaseline.result.stderr || fixedBaseline.result.stdout);

const uncertain = syntheticReport('uncertain', {
  caseScores: [
    { control: [false], policy: [false], skill: [true] },
    { control: [false], policy: [false], skill: [false] },
    { control: [false], policy: [false], skill: [false] },
  ],
});
expect('eval report cannot promote a favorable point estimate whose interval misses the threshold',
  uncertain.report?.skills?.['synthetic-skill']?.outcomeDelta > 0.1
    && uncertain.report.skills['synthetic-skill'].outcomeInterval.lower < 0.1
    && uncertain.report.skills['synthetic-skill'].ready === false
    && uncertain.report.skills['synthetic-skill'].decision === 'no-demonstrated-win',
  uncertain.result.stderr || uncertain.result.stdout);

const prepared = spawnSync(node, [path.join(root, 'scripts', 'eval-run.mjs'), '--case', 'postgres-required-handle', '--condition', 'checker', '--harness', 'codex', '--model', 'test-model', '--prepare-only'], { cwd: root, encoding: 'utf8' });
expect('eval runner prepares an isolated checker arm without invoking a model', prepared.status === 0 && /check-migrations\.js/.test(prepared.stdout), prepared.stderr || prepared.stdout);
const unsafeBypass = spawnSync(node, [path.join(root, 'scripts', 'eval-run.mjs'), '--case', 'cli-csv-statistics', '--condition', 'control', '--harness', 'codex', '--model', 'test-model', '--codex-external-sandbox'], { cwd: root, encoding: 'utf8' });
expect('eval runner refuses Codex bypass without an outer-sandbox declaration', unsafeBypass.status === 2 && /independently enforced outer sandbox/.test(unsafeBypass.stderr), unsafeBypass.stderr || unsafeBypass.stdout);
const wrongContainerHarness = spawnSync(node, [path.join(root, 'scripts', 'eval-run.mjs'), '--case', 'cli-csv-statistics', '--condition', 'control', '--harness', 'claude-code', '--model', 'test-model', '--codex-container', '--prepare-only'], { cwd: root, encoding: 'utf8' });
expect('eval runner confines container isolation mode to Codex', wrongContainerHarness.status === 2 && /only valid with --harness codex/.test(wrongContainerHarness.stderr), wrongContainerHarness.stderr || wrongContainerHarness.stdout);
const screenPlan = spawnSync(node, [path.join(root, 'scripts', 'eval-screen.mjs'), '--plan', path.join(root, 'eval', 'screens', 'priority-skills-luna-screen-2026-08-13.json')], { cwd: root, encoding: 'utf8' });
let parsedScreenPlan = null;
try { parsedScreenPlan = JSON.parse(screenPlan.stdout); } catch { /* asserted below */ }
expect('priority skill screen expands to exactly 90 randomized, isolated cells', screenPlan.status === 0 && parsedScreenPlan?.expectedRuns === 90 && parsedScreenPlan?.cells?.length === 90 && parsedScreenPlan.cells.every((cell) => typeof cell.order === 'string'), screenPlan.stderr || screenPlan.stdout);
const completedScreenPath = path.join(root, 'eval', 'screens', 'priority-skills-luna-screen-2026-08-13.json');
const completedScreen = JSON.parse(fs.readFileSync(completedScreenPath, 'utf8'));
if (completedScreen.runs.length === completedScreen.expectedRuns) {
  const screenReport = spawnSync(node, [path.join(root, 'scripts', 'eval-screen-report.mjs'), '--plan', completedScreenPath], { cwd: root, encoding: 'utf8' });
  let parsedScreenReport = null;
  try { parsedScreenReport = JSON.parse(screenReport.stdout); } catch { /* asserted below */ }
  expect('screen uncertainty uses independent cases instead of repeated trials', screenReport.status === 0 && Object.values(parsedScreenReport?.skills || {}).every((skill) => skill.skillVsPolicy.outcomeInterval95.n === 2), screenReport.stderr || screenReport.stdout);
  const tamperedPath = path.join(tmpBase, 'tampered-screen.json');
  const tampered = structuredClone(completedScreen);
  tampered.runs[0].costCredits += 0.01;
  fs.writeFileSync(tamperedPath, JSON.stringify(tampered));
  const rejectedTamper = spawnSync(node, [path.join(root, 'scripts', 'eval-screen-report.mjs'), '--plan', tamperedPath], { cwd: root, encoding: 'utf8' });
  expect('screen report rejects plan metrics that drift from the run bundle (mutation)', rejectedTamper.status === 1 && /mismatch/.test(rejectedTamper.stderr), rejectedTamper.stderr || rejectedTamper.stdout);
}
const compositionPlan = spawnSync(node, [path.join(root, 'scripts', 'eval-screen.mjs'), '--plan', path.join(root, 'eval', 'screens', 'composed-workflows-luna-screen-2026-08-13.json')], { cwd: root, encoding: 'utf8' });
let parsedCompositionPlan = null;
try { parsedCompositionPlan = JSON.parse(compositionPlan.stdout); } catch { /* asserted below */ }
expect('combined-skill screen expands separately to exactly 18 randomized cells', compositionPlan.status === 0 && parsedCompositionPlan?.expectedRuns === 18 && parsedCompositionPlan?.cells?.length === 18, compositionPlan.stderr || compositionPlan.stdout);

const cliRoot = path.join(tmpBase, 'eval-cli-pass');
fs.mkdirSync(path.join(cliRoot, 'src'), { recursive: true });
fs.writeFileSync(path.join(cliRoot, 'package.json'), JSON.stringify({ scripts: { test: 'node --test' } }));
fs.writeFileSync(path.join(cliRoot, 'src', 'cli.js'), `
const fs = require('fs');
if (process.argv[2] === '--help') { console.log('Usage: cli <csv> - print statistics'); process.exit(0); }
let text;
try { text = fs.readFileSync(process.argv[2], 'utf8'); } catch (e) { console.error(e.message); process.exit(1); }
if (/\"[^\"]*$/.test(text)) { console.error('malformed CSV'); process.exit(1); }
const [head, ...rows] = text.trim().split(/\\r?\\n/).map(r => r.split(','));
const means = {};
for (let i = 0; i < head.length; i++) {
  const values = rows.map(r => Number(r[i]));
  if (values.every(Number.isFinite)) means[head[i]] = values.reduce((a, b) => a + b, 0) / values.length;
}
console.log(JSON.stringify({ rowCount: rows.length, means }));
`);
fs.writeFileSync(path.join(cliRoot, 'src', 'cli.test.js'), `const test = require('node:test'); test('smoke', () => {});`);
const cliGrade = spawnSync(node, [path.join(root, 'eval', 'graders-v2', 'cli-csv-statistics.mjs'), '--root', cliRoot], { cwd: root, encoding: 'utf8' });
expect('CLI outcome grader accepts a conforming implementation', cliGrade.status === 0, cliGrade.stderr || cliGrade.stdout);

const migrationRoot = path.join(tmpBase, 'eval-migration-pass');
fs.mkdirSync(path.join(migrationRoot, 'migrations'), { recursive: true });
fs.writeFileSync(path.join(migrationRoot, 'migrations', '002_add_handle.sql'), `
ALTER TABLE accounts ADD COLUMN handle text;
UPDATE accounts SET handle = username WHERE handle IS NULL;
CREATE UNIQUE INDEX CONCURRENTLY accounts_handle_uq ON accounts(handle);
ALTER TABLE accounts ADD CONSTRAINT accounts_handle_nn CHECK (handle IS NOT NULL) NOT VALID;
ALTER TABLE accounts VALIDATE CONSTRAINT accounts_handle_nn;
ALTER TABLE accounts ALTER COLUMN handle SET NOT NULL;
`);
const migrationGrade = spawnSync(node, [path.join(root, 'eval', 'graders-v2', 'postgres-required-handle.mjs'), '--root', migrationRoot], { cwd: root, encoding: 'utf8' });
expect('migration outcome grader accepts an additive rollout', migrationGrade.status === 0, migrationGrade.stderr || migrationGrade.stdout);

const multiSkillCases = ['self-serve-project-invites', 'refund-ledger-rollout'];
for (const caseId of multiSkillCases) {
  const caseDefinition = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', `${caseId}.json`), 'utf8'));
  expect(`${caseId} names a unique multi-skill composition`,
    Array.isArray(caseDefinition.skills) && caseDefinition.skills.length >= 2
      && new Set(caseDefinition.skills).size === caseDefinition.skills.length
      && caseDefinition.skills.includes(caseDefinition.skill));
  const grader = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const reject = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'fixtures-v2', caseId)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader rejects the unfinished task fixture`, reject.status === 1, reject.stderr || reject.stdout);
  const accept = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'grader-fixtures-v2', `${caseId}-pass`)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader accepts an independent conforming fixture`, accept.status === 0, accept.stderr || accept.stdout);
}

const freshEfficacyCases = [
  'job-ledger-ordering-assessment',
  'zero-count-export-acceptance',
  // engineering-assessment's second and third cases. Promotion needs three
  // fresh cases per skill; the first, engineering-assessment-cited-risks,
  // has three trials per condition on claude-code as of 2026-08-18.
  'engineering-assessment-retry-storm',
  'engineering-assessment-silent-drop',
];
for (const caseId of freshEfficacyCases) {
  const grader = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const reject = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'fixtures-v2', caseId)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader rejects the adversarial task fixture`, reject.status === 1, reject.stderr || reject.stdout);
  const accept = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'grader-fixtures-v2', `${caseId}-pass`)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader accepts an independent conforming fixture`, accept.status === 0, accept.stderr || accept.stdout);
}

const freshScreenCases = ['retry-delay-regression-suite', 'json-config-setter', 'project-label-library'];
for (const caseId of freshScreenCases) {
  const caseDefinition = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', `${caseId}.json`), 'utf8'));
  expect(`${caseId} remains a single-skill efficacy case`, !('skills' in caseDefinition));
  const grader = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const reject = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'fixtures-v2', caseId)], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  expect(`${caseId} outcome grader rejects the unfinished task fixture`, reject.status === 1, reject.stderr || reject.stdout);
  const accept = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'grader-fixtures-v2', `${caseId}-pass`)], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  expect(`${caseId} outcome grader accepts an independent conforming fixture`, accept.status === 0, accept.stderr || accept.stdout);
}

// ---------- Promotion thresholds cannot be quietly weakened ----------
// eval/README.md promises "CI rejects weakening them". Replication counts,
// conditions, harnesses and confidence were floored; the effect sizes were
// not — `outcomeDeltaRequired: 0` passed verification, which would make
// every recorded null promotable. Each mutation below must fail.
{
  const evidencePath = path.join(root, 'eval', 'evidence.json');
  const original = fs.readFileSync(evidencePath, 'utf8');
  const weakenings = [
    ['outcomeDeltaRequired', 0],
    ['efficiencyReductionRequired', 0],
    ['outcomeNonInferiorityMargin', 0.5],
    ['trialsPerCondition', 1],
  ];
  try {
    for (const [key, value] of weakenings) {
      const doc = JSON.parse(original);
      doc.minimumEvidence[key] = value;
      fs.writeFileSync(evidencePath, `${JSON.stringify(doc, null, 2)}\n`);
      const r = spawnSync(node, [path.join(root, 'scripts', 'eval-verify.mjs')], { cwd: root, encoding: 'utf8' });
      expect(`eval-verify rejects ${key}=${value}`, r.status !== 0, r.stdout || r.stderr);
    }
  } finally {
    fs.writeFileSync(evidencePath, original);
  }
  const restored = spawnSync(node, [path.join(root, 'scripts', 'eval-verify.mjs')], { cwd: root, encoding: 'utf8' });
  expect('eval-verify passes again once thresholds are restored', restored.status === 0, restored.stdout || restored.stderr);
}
