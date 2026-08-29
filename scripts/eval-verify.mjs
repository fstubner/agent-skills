#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { hashTree, sha256 } from './lib/tree-hash.mjs';

const require = createRequire(import.meta.url);
const { validate } = require('../core/lib/schema.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evalRoot = path.join(root, 'eval');
const failures = [];
const note = (message) => console.log(`ok - ${message}`);
const fail = (message) => failures.push(message);

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { fail(`${path.relative(root, file)}: ${error.message}`); return null; }
}

function resolveInside(base, relative, label) {
  const resolved = path.resolve(base, relative);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    fail(`${label}: path escapes its evidence bundle: ${relative}`);
    return null;
  }
  return resolved;
}

const caseSchema = readJson(path.join(root, 'core', 'schemas', 'eval-case-v2.schema.json'));
const gradingSchema = readJson(path.join(root, 'core', 'schemas', 'eval-grading-v2.schema.json'));
const runSchema = readJson(path.join(root, 'core', 'schemas', 'eval-run-v2.schema.json'));
const evidenceSchema = readJson(path.join(root, 'core', 'schemas', 'eval-evidence.schema.json'));
const cases = new Map();
const casesDir = path.join(evalRoot, 'cases-v2');

for (const name of fs.readdirSync(casesDir).filter((name) => name.endsWith('.json')).sort()) {
  const file = path.join(casesDir, name);
  const value = readJson(file);
  if (!value) continue;
  for (const error of validate(caseSchema, value)) fail(`${path.relative(root, file)} ${error}`);
  if (value.id !== path.basename(name, '.json')) fail(`${name}: id must match filename`);
  if (cases.has(value.id)) fail(`${name}: duplicate case id ${value.id}`);
  cases.set(value.id, { file, value, raw: fs.readFileSync(file) });
  for (const property of ['fixture', 'grader']) {
    const target = resolveInside(root, value[property], `${name}.${property}`);
    if (target && !fs.existsSync(target)) fail(`${name}: missing ${property} ${value[property]}`);
  }
  if (value.checker) {
    const checker = resolveInside(root, value.checker, `${name}.checker`);
    if (checker && !fs.existsSync(checker)) fail(`${name}: missing checker ${value.checker}`);
  }
  const conditions = new Set(value.conditions);
  if (conditions.size !== value.conditions.length) fail(`${name}: conditions must be unique`);
  for (const required of ['control', 'policy', 'skill']) {
    if (!conditions.has(required)) fail(`${name}: missing required condition ${required}`);
  }
  if (conditions.has('checker') !== Boolean(value.checker)) fail(`${name}: checker path and checker condition must appear together`);
  const assertionIds = value.assertions.map((assertion) => assertion.id);
  if (new Set(assertionIds).size !== assertionIds.length) fail(`${name}: assertion ids must be unique`);
}
note(`${cases.size} reproducible v2 cases validated`);

const runsDir = path.join(evalRoot, 'runs');
let runCount = 0;
if (fs.existsSync(runsDir)) {
  for (const entry of fs.readdirSync(runsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const runDir = path.join(runsDir, entry.name);
    const manifestPath = path.join(runDir, 'run.json');
    if (!fs.existsSync(manifestPath)) { fail(`eval/runs/${entry.name}: missing run.json`); continue; }
    const manifest = readJson(manifestPath);
    if (!manifest) continue;
    runCount++;
    for (const error of validate(runSchema, manifest)) fail(`eval/runs/${entry.name}/run.json ${error}`);
    if (manifest.runId !== entry.name) fail(`eval/runs/${entry.name}: runId must match directory`);
    const caseEntry = cases.get(manifest.caseId);
    if (!caseEntry) { fail(`eval/runs/${entry.name}: unknown case ${manifest.caseId}`); continue; }
    if (manifest.caseRevision !== caseEntry.value.revision) fail(`eval/runs/${entry.name}: stale case revision`);
    // A retired case carries the sha its runs were graded against, so adding
    // the retirement marker does not invalidate them. Only that one prior sha
    // is accepted — any other edit still fails, so retirement cannot be used
    // as a licence to rewrite a case after the fact.
    const acceptedShas = [sha256(caseEntry.raw)];
    if (caseEntry.value?.supersededBy && caseEntry.value.supersededCaseSha256) {
      acceptedShas.push(caseEntry.value.supersededCaseSha256);
    }
    if (!acceptedShas.includes(manifest.caseSha256)) fail(`eval/runs/${entry.name}: case content changed after the run`);
    // The fixture is as much a part of the task as the prompt. Bundles written
    // before the field existed carry no hash and are left unbound rather than
    // backfilled — a backfilled digest would assert that a fixture had not
    // changed, which nobody measured.
    if (manifest.fixtureSha256) {
      const fixtureDir = resolveInside(root, caseEntry.value.fixture, `${manifest.caseId}.fixture`);
      if (fixtureDir && fs.existsSync(fixtureDir) && manifest.fixtureSha256 !== hashTree(fixtureDir)) {
        fail(`eval/runs/${entry.name}: fixture content changed after the run`);
      }
    }
    if (!caseEntry.value.conditions.includes(manifest.condition)) fail(`eval/runs/${entry.name}: condition is not configured by case`);
    const resolvedFiles = {};
    for (const [key, relative] of Object.entries(manifest.files || {})) {
      const resolved = resolveInside(runDir, relative, `eval/runs/${entry.name}.${key}`);
      if (resolved && !fs.existsSync(resolved)) fail(`eval/runs/${entry.name}: missing ${key} file ${relative}`);
      resolvedFiles[key] = resolved;
    }
    if (!resolvedFiles.grading || !fs.existsSync(resolvedFiles.grading)) continue;
    const grading = readJson(resolvedFiles.grading);
    if (!grading) continue;
    for (const error of validate(gradingSchema, grading)) fail(`eval/runs/${entry.name}/grading.json ${error}`);
    if (grading.caseId !== manifest.caseId) fail(`eval/runs/${entry.name}: grader caseId mismatch`);
    const expectedIds = caseEntry.value.assertions.map((assertion) => assertion.id).sort();
    const actualIds = grading.assertions.map((assertion) => assertion.id).sort();
    if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) fail(`eval/runs/${entry.name}: grader assertion ids differ from case`);
    const counts = {
      passed: grading.assertions.filter((assertion) => assertion.status === 'pass').length,
      failed: grading.assertions.filter((assertion) => assertion.status === 'fail').length,
      notEvaluated: grading.assertions.filter((assertion) => assertion.status === 'not_evaluated').length,
      total: grading.assertions.length,
    };
    if (JSON.stringify(counts) !== JSON.stringify(manifest.grading)) fail(`eval/runs/${entry.name}: grading counts are stale`);
    if (resolvedFiles.workspace && fs.existsSync(resolvedFiles.workspace) && manifest.artifactSha256 !== hashTree(resolvedFiles.workspace)) {
      fail(`eval/runs/${entry.name}: output artifact hash mismatch`);
    }
  }
}
note(`${runCount} complete v2 run bundles validated`);

const evidence = readJson(path.join(evalRoot, 'evidence.json'));
if (evidence) {
  for (const error of validate(evidenceSchema, evidence)) fail(`eval/evidence.json ${error}`);
  if (evidence.status === 'unvalidated' && evidence.supportedClaims.length !== 0) fail('eval/evidence.json: unvalidated evidence cannot support claims');
  if (evidence.legacyResultsAreEvidence !== false) fail('eval/evidence.json: legacy results must remain quarantined');
  if (evidence.minimumEvidence.freshCasesPerSkill < 3 || evidence.minimumEvidence.trialsPerCondition < 3) fail('eval/evidence.json: minimum replication was weakened');
  for (const condition of ['control', 'policy', 'skill']) {
    if (!evidence.minimumEvidence.requiredConditions.includes(condition)) fail(`eval/evidence.json: required condition ${condition} was removed`);
  }
  for (const harness of ['claude-code', 'codex']) {
    if (!evidence.minimumEvidence.requiredHarnesses.includes(harness)) fail(`eval/evidence.json: required harness ${harness} was removed`);
    if (!evidence.minimumEvidence.requiredModelsByHarness[harness]?.length) fail(`eval/evidence.json: required model cohort for ${harness} was removed`);
  }
  if (evidence.minimumEvidence.primaryBaselineCondition !== 'policy') fail('eval/evidence.json: primary baseline must remain pre-specified as policy');
  if (evidence.minimumEvidence.confidenceLevel !== 0.95) fail('eval/evidence.json: promotion confidence level must remain 95%');
  // Replication, conditions, harnesses and confidence were floored; the
  // effect sizes were not. `outcomeDeltaRequired: 0` would have passed
  // verification while making every recorded null promotable — the single
  // number that decides "did the skill help" was the one number a future
  // edit could quietly move.
  const effectFloors = [
    ['outcomeDeltaRequired', 0.1, 'required outcome lift'],
    ['efficiencyReductionRequired', 0.1, 'required efficiency gain'],
  ];
  for (const [key, floor, label] of effectFloors) {
    if (!(evidence.minimumEvidence[key] >= floor)) {
      fail(`eval/evidence.json: ${label} (${key}) was weakened below ${floor}`);
    }
  }
  // This one is a tolerance, so weakening means going UP.
  if (!(evidence.minimumEvidence.outcomeNonInferiorityMargin <= 0.02)) {
    fail('eval/evidence.json: non-inferiority margin was loosened above 0.02');
  }
}

const claimFiles = ['README.md', 'INSTALL.md', 'eval/README.md'];
for (const relative of claimFiles) {
  const body = fs.readFileSync(path.join(root, relative), 'utf8');
  if (!/EVIDENCE STATUS:\s*UNVALIDATED/i.test(body)) fail(`${relative}: missing unvalidated evidence banner`);
  for (const forbidden of [/content earns its place/i, /efficacy[^\n]{0,80}measured well/i, /forced evidence for all 17 skills/i]) {
    if (forbidden.test(body)) fail(`${relative}: contains unsupported efficacy claim ${forbidden}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`not ok - ${failure}`);
  console.error(`\n${failures.length} evaluation evidence failure(s)`);
  process.exit(1);
}
console.log('\nEvaluation evidence is internally consistent. No efficacy claim is currently supported.');
