#!/usr/bin/env node
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
};
const planArg = valueAfter('--plan');
if (!planArg) {
  console.error('usage: node scripts/eval-screen.mjs --plan <screen.json> [--run]');
  process.exit(2);
}
const planPath = path.resolve(planArg);
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));

function fail(message) {
  console.error(message);
  process.exit(2);
}

for (const field of ['id', 'harness', 'model', 'seed', 'conditions', 'trials', 'hardBudgetCredits', 'maxPerRunCredits', 'skills', 'runs']) {
  if (plan[field] === undefined) fail(`screen plan missing ${field}`);
}
if (plan.harness !== 'codex' || plan.model !== 'gpt-5.6-luna') fail('screen runner currently requires codex/gpt-5.6-luna');
if (!Array.isArray(plan.conditions) || new Set(plan.conditions).size !== plan.conditions.length) fail('conditions must be a unique array');
if (!Number.isInteger(plan.trials) || plan.trials < 1) fail('trials must be a positive integer');
if (!Array.isArray(plan.runs)) fail('runs must be an array');

const cells = [];
for (const [skill, caseIds] of Object.entries(plan.skills)) {
  if (!Array.isArray(caseIds) || caseIds.length === 0 || new Set(caseIds).size !== caseIds.length) fail(`${skill} case list must be non-empty and unique`);
  for (const caseId of caseIds) {
    const testCase = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', `${caseId}.json`), 'utf8'));
    if (testCase.skill !== skill || (Array.isArray(testCase.skills) && !plan.allowCompositions)) fail(`${caseId} is not an isolated ${skill} case`);
    for (const condition of plan.conditions) {
      if (!testCase.conditions.includes(condition)) fail(`${caseId} does not support ${condition}`);
      for (let trial = 1; trial <= plan.trials; trial++) cells.push({ skill, caseId, condition, trial });
    }
  }
}
for (const cell of cells) {
  cell.key = `${cell.caseId}:${cell.condition}:${cell.trial}`;
  cell.order = crypto.createHash('sha256').update(`${plan.seed}:${cell.key}`).digest('hex');
}
cells.sort((a, b) => a.order.localeCompare(b.order));
if (plan.expectedRuns !== cells.length) fail(`expectedRuns is ${plan.expectedRuns}; expanded plan has ${cells.length}`);
const recordedKeys = new Set();
const recordedRunIds = new Set();
for (const run of plan.runs) {
  if (!cells.some((cell) => cell.key === run.key)) fail(`recorded run has unknown key ${run.key}`);
  if (recordedKeys.has(run.key)) fail(`duplicate recorded run ${run.key}`);
  if (recordedRunIds.has(run.runId)) fail(`duplicate recorded run id ${run.runId}`);
  recordedKeys.add(run.key);
  recordedRunIds.add(run.runId);
  const [caseId, condition] = run.key.split(':');
  const runDir = path.join(root, 'eval', 'runs', run.runId);
  const manifestPath = path.join(runDir, 'run.json');
  if (!fs.existsSync(manifestPath)) fail(`recorded run bundle missing for ${run.runId}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.runId !== run.runId || manifest.caseId !== caseId || manifest.condition !== condition || manifest.harness !== plan.harness || manifest.model !== plan.model) fail(`recorded run provenance mismatch for ${run.runId}`);
  if (manifest.costCredits !== run.costCredits || manifest.totalTokens !== run.totalTokens || manifest.grading.passed !== run.passed || manifest.grading.total !== run.total) fail(`recorded run metrics mismatch for ${run.runId}`);
}

plan.attempts ||= [];
const spent = () => [...plan.runs, ...plan.attempts].reduce((sum, run) => sum + (run.costCredits || 0), 0);
if (!args.includes('--run')) {
  console.log(JSON.stringify({ id: plan.id, expectedRuns: cells.length, completedRuns: plan.runs.length, remainingRuns: cells.length - plan.runs.length, spentCredits: spent(), dispatchBudgetCredits: plan.hardBudgetCredits, budgetScope: 'parseable run attempts; provider usage cannot be pre-authorized by this harness', cells }, null, 2));
  process.exit(0);
}

for (const cell of cells.filter((item) => !recordedKeys.has(item.key))) {
  if (spent() + plan.maxPerRunCredits > plan.hardBudgetCredits) fail(`budget stop before ${cell.key}: ${spent()} spent`);
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'eval-run.mjs'), '--case', cell.caseId, '--condition', cell.condition, '--harness', plan.harness, '--model', plan.model, '--timeout-ms', String(plan.timeoutMs || 600_000), '--codex-container'], {
    cwd: root,
    encoding: 'utf8',
    timeout: (plan.timeoutMs || 600_000) + 120_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  let manifest;
  try { manifest = JSON.parse(result.stdout); }
  catch {
    plan.attempts.push({ key: cell.key, runId: null, costCredits: null, reason: 'runner emitted invalid JSON; provider spend unknown' });
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
    fail(`runner emitted invalid JSON for ${cell.key}: ${result.stderr || result.stdout}`);
  }
  if (manifest.exitCode !== 0 || manifest.grading.notEvaluated !== 0 || typeof manifest.totalTokens !== 'number' || typeof manifest.costCredits !== 'number') {
    plan.attempts.push({ key: cell.key, runId: manifest.runId || null, costCredits: typeof manifest.costCredits === 'number' ? manifest.costCredits : null, reason: 'invalid run provenance or grading' });
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
    fail(`invalid run ${manifest.runId} for ${cell.key}`);
  }
  if (manifest.costCredits > plan.maxPerRunCredits) {
    plan.attempts.push({ key: cell.key, runId: manifest.runId, costCredits: manifest.costCredits, reason: 'per-run dispatch ceiling exceeded' });
    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
    fail(`per-run budget exceeded by ${manifest.runId}: ${manifest.costCredits}`);
  }
  plan.runs.push({ key: cell.key, runId: manifest.runId, costCredits: manifest.costCredits, totalTokens: manifest.totalTokens, passed: manifest.grading.passed, total: manifest.grading.total });
  const tempPath = `${planPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(plan, null, 2) + '\n');
  fs.renameSync(tempPath, planPath);
  console.log(JSON.stringify(plan.runs.at(-1)));
}
