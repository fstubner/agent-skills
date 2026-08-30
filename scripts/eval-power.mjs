#!/usr/bin/env node
// How many fresh cases does a skill need before its CI can clear the bar?
//
// The promotion contract sets freshCasesPerSkill: 3 and requires a 95% CI
// lower bound above outcomeDeltaRequired. Those two numbers were chosen
// independently, and together they are far stricter than either looks: at the
// case-level variance actually observed, three cases demand a mean delta above
// 0.43 before the interval clears 0.1. A bar nothing can reach is not a strict
// bar, it is an unstated one.
//
// This derives the case count instead of asserting it.
//
// The discipline that keeps this from being a bar fitted to results: sigma
// MUST come from data because there is nowhere else to get it, but the effect
// the design is required to detect must NOT. It is stated as a multiple of the
// threshold the contract already declares meaningful — detect twice what you
// are willing to call a win — so the answer does not move when a skill scores
// well or badly.
//
// Usage:
//   node scripts/eval-power.mjs [--design-multiple 2] [--power 0.8] [--sigma <n>]

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const num = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(args[i + 1]);
};
const designMultiple = num('design-multiple', 2);
const power = num('power', 0.8);

// TWO-SIDED 95% t values, deliberately identical to eval-report.mjs's T95.
// The first draft of this file used one-sided quantiles and understated the
// required case count by a wide margin: a power calculation has to describe
// the interval the gate actually computes, not a tidier one.
const T95 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042 };
const T80 = { 1: 1.376, 2: 0.816, 3: 0.765, 4: 0.741, 5: 0.727, 6: 0.718, 7: 0.711, 8: 0.706, 9: 0.703, 10: 0.700, 11: 0.697, 12: 0.695, 14: 0.692, 15: 0.691, 19: 0.688, 20: 0.687, 24: 0.685, 29: 0.683, 39: 0.681, 59: 0.679, 119: 0.677 };
const lookup = (table, df, floor) => {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const hit = keys.find((k) => k >= df);
  return hit === undefined ? floor : table[hit];
};

const evidence = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8'));
const threshold = evidence.minimumEvidence.outcomeDeltaRequired;
const configuredCases = evidence.minimumEvidence.freshCasesPerSkill;

// Pool the WITHIN-skill spread of case deltas. Pooling raw deltas across
// skills would fold in between-skill differences that a per-skill interval
// never sees, inflating sigma and overstating the case count.
function observedSigma() {
  const report = spawnSync(process.execPath, [path.join(root, 'scripts', 'eval-report.mjs')], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  const parsed = JSON.parse(report.stdout);
  let ss = 0;
  let df = 0;
  const perSkill = [];
  for (const [skill, value] of Object.entries(parsed.skills)) {
    const deltas = (value.caseComparisons || []).map((c) => c.outcomeDelta).filter((x) => x != null);
    if (deltas.length < 2) continue;
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const sumSq = deltas.reduce((a, b) => a + (b - mean) ** 2, 0);
    ss += sumSq;
    df += deltas.length - 1;
    perSkill.push({ skill, n: deltas.length, sd: Math.sqrt(sumSq / (deltas.length - 1)) });
  }
  if (!df) return null;
  // Upper confidence bound on sigma, so a lucky-low estimate does not produce
  // a case count that cannot hold up.
  const chi2Lower = { 1: 0.00393, 2: 0.1026, 3: 0.3518, 4: 0.7107, 5: 1.1455, 6: 1.635, 7: 2.167, 8: 2.733, 10: 3.940 };
  const crit = chi2Lower[df];
  return {
    perSkill,
    df,
    sigma: Math.sqrt(ss / df),
    sigmaUpper: crit ? Math.sqrt(ss / crit) : null,
  };
}

const observed = observedSigma();
if (!observed) {
  console.error('no skill has two or more completed cases yet; sigma cannot be estimated');
  process.exit(1);
}
const sigmaArg = num('sigma', null);
const designEffect = threshold * designMultiple;

// Smallest n where a true effect of designEffect yields a CI lower bound above
// threshold with the requested power.
function requiredCases(sigma) {
  for (let n = 2; n <= 200; n++) {
    const df = n - 1;
    const need = (lookup(T95, df, 1.96) + (power === 0.8 ? lookup(T80, df, 0.674) : 0)) * (sigma / Math.sqrt(n));
    if (designEffect - threshold >= need) return n;
  }
  return null;
}

const rows = [
  ['pooled estimate', sigmaArg ?? observed.sigma],
  ...(sigmaArg == null && observed.sigmaUpper ? [['95% upper bound on sigma', observed.sigmaUpper]] : []),
];

console.log(`threshold (outcomeDeltaRequired) : ${threshold}`);
console.log(`design effect (${designMultiple}x threshold)      : ${designEffect.toFixed(3)}`);
console.log(`power                            : ${power}`);
console.log(`configured freshCasesPerSkill    : ${configuredCases}`);
console.log();
for (const { skill, n, sd } of observed.perSkill) {
  console.log(`  ${skill.padEnd(24)}n=${n}  SD=${sd.toFixed(4)}`);
}
console.log(`  pooled df=${observed.df}`);
console.log();
for (const [label, sigma] of rows) {
  const n = requiredCases(sigma);
  console.log(`${label.padEnd(28)}sigma=${sigma.toFixed(4)}  ->  ${n ? `${n} cases` : 'more than 200 cases'}`);
}
console.log();
console.log('what the CURRENT configuration can detect:');
const df = configuredCases - 1;
const halfWidth = lookup(T95, df, 1.96) * (observed.sigma / Math.sqrt(configuredCases));
console.log(`  at n=${configuredCases}, a mean delta below ${(threshold + halfWidth).toFixed(3)} can never clear the bar`);
