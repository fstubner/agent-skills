#!/usr/bin/env node
// Pass rate per ASSERTION ID, pooled across every case that declares it.
//
// eval-report already classifies assertions within one case/harness/model
// block (discriminating / undiscriminating / unreachable). It never pools the
// same id across the cases that share it, and that is where the signal was
// hiding: `coverage-honesty` appears in six cases, `verdict-is-block` in two,
// and pooled they carry far more runs than any single block.
//
// This is a DIAGNOSTIC, like the per-block version. It does not enter the
// promotion decision. The promotion metric averages a case's whole rubric on
// purpose, because picking the assertions that flatter a skill after seeing
// the results is how a bar gets moved to fit the data. What this shows is
// which specific behaviours move — a different question from whether a skill
// clears the bar.
//
// Skill arms are restricted to the CURRENT skill text by default. Pooling a
// rule's pass rate across skill versions that did and did not contain that
// rule would measure the average of two different skills. --all-versions
// disables that, and prints both counts so the difference is visible.
//
// Usage:
//   node scripts/eval-assertion-rollup.mjs [--all-versions] [--min-runs <n>]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { currentSkillDigest } from './lib/eval-versions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const allVersions = args.includes('--all-versions');
const minRuns = Number(args[args.indexOf('--min-runs') + 1]) || 8;

const cases = new Map(fs.readdirSync(path.join(root, 'eval', 'cases-v2'))
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const value = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', name), 'utf8'));
    return [value.id, value];
  }));

const digestCache = new Map();
function currentDigestFor(testCase) {
  if (!digestCache.has(testCase.id)) {
    digestCache.set(testCase.id, currentSkillDigest(root, testCase.skills || [testCase.skill]));
  }
  return digestCache.get(testCase.id);
}

const tally = new Map();
let skipped = 0;
for (const dir of fs.readdirSync(path.join(root, 'eval', 'runs'))) {
  const runDir = path.join(root, 'eval', 'runs', dir);
  let manifest;
  let grading;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'run.json'), 'utf8'));
    grading = JSON.parse(fs.readFileSync(path.join(runDir, 'grading.json'), 'utf8'));
  } catch { continue; }
  const testCase = cases.get(manifest.caseId);
  if (!testCase || testCase.supersededBy) continue;
  // Same eligibility the promotion report applies, so a harness failure is
  // not read as a model outcome.
  if (manifest.exitCode !== 0 || manifest.grading.notEvaluated !== 0) continue;
  if (!['control', 'policy', 'skill'].includes(manifest.condition)) continue;
  if (manifest.condition === 'skill' && !allVersions) {
    const current = currentDigestFor(testCase);
    if (current && manifest.stagedInputSha256 !== current) { skipped++; continue; }
  }
  for (const grade of grading.assertions || []) {
    if (grade.status === 'not_evaluated') continue;
    if (!tally.has(grade.id)) {
      tally.set(grade.id, { cases: new Set(), control: [0, 0], policy: [0, 0], skill: [0, 0] });
    }
    const row = tally.get(grade.id);
    row.cases.add(manifest.caseId);
    row[manifest.condition][1] += 1;
    if (grade.status === 'pass') row[manifest.condition][0] += 1;
  }
}

// Normal approximation. Reported to three places and not dressed up: with
// cells this small it is indicative, and a row under --min-runs is not shown
// at all rather than shown with a meaningless p-value.
const erf = (x) => {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592)
    * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const pnorm = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

function compare(a, b) {
  if (!a[1] || !b[1]) return null;
  const p1 = a[0] / a[1];
  const p2 = b[0] / b[1];
  const pooled = (a[0] + b[0]) / (a[1] + b[1]);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / a[1] + 1 / b[1]));
  if (!se) return null;
  const z = (p1 - p2) / se;
  return { z, p: 1 - pnorm(z) };
}

const rows = [...tally.entries()]
  .map(([id, row]) => {
    const total = row.control[1] + row.policy[1] + row.skill[1];
    return { id, caseCount: row.cases.size, total, ...row, vsPolicy: compare(row.skill, row.policy) };
  })
  .filter((row) => row.total >= minRuns)
  .sort((a, b) => (a.vsPolicy?.p ?? 1) - (b.vsPolicy?.p ?? 1));

const rate = ([pass, graded]) => (graded ? `${Math.round((100 * pass) / graded)}% (${pass}/${graded})` : '-');
console.log(`skill arms restricted to current skill text: ${!allVersions}${allVersions ? '' : ` (${skipped} superseded runs excluded)`}`);
console.log(`assertions with at least ${minRuns} graded runs: ${rows.length}\n`);
console.log(`${'assertion'.padEnd(32)}${'cases'.padEnd(7)}${'control'.padEnd(14)}${'policy'.padEnd(14)}${'skill'.padEnd(14)}one-sided P`);
for (const row of rows) {
  console.log(
    row.id.padEnd(32)
    + String(row.caseCount).padEnd(7)
    + rate(row.control).padEnd(14)
    + rate(row.policy).padEnd(14)
    + rate(row.skill).padEnd(14)
    + (row.vsPolicy ? row.vsPolicy.p.toFixed(5) : '-'),
  );
}
