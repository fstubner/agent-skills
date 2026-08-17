#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const planIndex = args.indexOf('--plan');
if (planIndex === -1 || !args[planIndex + 1]) {
  console.error('usage: node scripts/eval-screen-report.mjs --plan <screen.json>');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(path.resolve(args[planIndex + 1]), 'utf8'));
if (plan.runs.length !== plan.expectedRuns) {
  console.error(`screen incomplete: ${plan.runs.length}/${plan.expectedRuns}`);
  process.exit(1);
}
const byKey = new Map(plan.runs.map((run) => [run.key, run]));
if (byKey.size !== plan.runs.length || new Set(plan.runs.map((run) => run.runId)).size !== plan.runs.length) {
  console.error('screen plan contains duplicate keys or run ids');
  process.exit(1);
}
for (const run of plan.runs) {
  const [caseId, condition] = run.key.split(':');
  const runDir = path.join(root, 'eval', 'runs', run.runId);
  const manifestPath = path.join(runDir, 'run.json');
  if (!fs.existsSync(manifestPath)) {
    console.error(`run bundle missing for ${run.runId}`);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.caseId !== caseId || manifest.condition !== condition || manifest.harness !== plan.harness || manifest.model !== plan.model
    || manifest.costCredits !== run.costCredits || manifest.totalTokens !== run.totalTokens || manifest.grading.passed !== run.passed || manifest.grading.total !== run.total) {
    console.error(`run bundle mismatch for ${run.runId}`);
    process.exit(1);
  }
}
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const T95 = [null, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447];
function interval(values) {
  if (values.length < 2) return { n: values.length, lower: null, upper: null };
  const estimate = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - estimate) ** 2, 0) / (values.length - 1);
  const margin = T95[Math.min(values.length - 1, 6)] * Math.sqrt(variance / values.length);
  return { n: values.length, lower: estimate - margin, upper: estimate + margin };
}

const report = {
  schemaVersion: 1,
  screenId: plan.id,
  preliminary: true,
  note: 'Single-harness screening evidence only; promotion still requires the complete eval/evidence.json matrix.',
  completedRuns: plan.runs.length,
  spentCredits: plan.runs.reduce((sum, run) => sum + run.costCredits, 0),
  skills: {},
};
for (const [skill, caseIds] of Object.entries(plan.skills)) {
  const cells = [];
  for (const caseId of caseIds) {
    for (let trial = 1; trial <= plan.trials; trial++) {
      const row = { caseId, trial };
      for (const condition of plan.conditions) row[condition] = byKey.get(`${caseId}:${condition}:${trial}`);
      cells.push(row);
    }
  }
  const summarize = (condition) => ({
    outcomeRate: mean(cells.map((cell) => cell[condition].passed / cell[condition].total)),
    meanCredits: mean(cells.map((cell) => cell[condition].costCredits)),
    meanTokens: mean(cells.map((cell) => cell[condition].totalTokens)),
  });
  const conditions = Object.fromEntries(plan.conditions.map((condition) => [condition, summarize(condition)]));
  // Cases, not repeated trials, are the independent task samples. Average
  // trials within each case before estimating uncertainty.
  const caseRows = caseIds.map((caseId) => cells.filter((cell) => cell.caseId === caseId));
  const outcomeDeltas = caseRows.map((rows) => mean(rows.map((cell) => cell.skill.passed / cell.skill.total - cell.policy.passed / cell.policy.total)));
  const creditDeltas = caseRows.map((rows) => mean(rows.map((cell) => cell.skill.costCredits / cell.policy.costCredits - 1)));
  const tokenDeltas = caseRows.map((rows) => mean(rows.map((cell) => cell.skill.totalTokens / cell.policy.totalTokens - 1)));
  report.skills[skill] = {
    conditions,
    skillVsPolicy: {
      outcomeDelta: mean(outcomeDeltas),
      outcomeInterval95: interval(outcomeDeltas),
      creditDelta: mean(creditDeltas),
      creditInterval95: interval(creditDeltas),
      tokenDelta: mean(tokenDeltas),
      tokenInterval95: interval(tokenDeltas),
    },
  };
}
const output = JSON.stringify(report, null, 2) + '\n';
const outIndex = args.indexOf('--out');
if (outIndex !== -1) {
  if (!args[outIndex + 1]) {
    console.error('--out requires a path');
    process.exit(2);
  }
  fs.writeFileSync(path.resolve(args[outIndex + 1]), output);
}
console.log(output.trimEnd());
