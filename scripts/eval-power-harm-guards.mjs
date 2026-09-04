#!/usr/bin/env node
// What would it take to detect a harm-guard regression?
//
// eval-power.mjs derives the CASE count for the outcome comparison. Nothing
// equivalent was ever derived for harm guards, and on 2026-09-03 that bill
// came due: a skill edit aimed at a measured -18.3pp harm-guard regression
// produced a paired result of -8.3pp with a 95% interval spanning 26 points.
// The measurement could not say whether the fix helped, hurt, or did nothing.
//
// Two separate problems, and the first is not statistical.
//
// RESOLUTION. A case's harm-guard rate is (assertions passed) / (assertions),
// averaged over trials. With A assertions and T trials the rate can only land
// on multiples of 1/(A*T). Nine of engineering-assessment's ten harm-guard
// cases carry ONE assertion; at three trials the only reachable values are 0,
// 1/3, 2/3 and 1. The smallest non-zero change a case can show is 33 points.
// A 10-point regression is not a small effect here — it is unrepresentable.
//
// POWER. Given the resolution, the between-case spread of paired deltas then
// decides how many cases are needed. Both are reported, because adding cases
// cannot fix a resolution problem and adding assertions cannot fix a spread
// problem.
//
// Discipline, the same as eval-power.mjs: sigma MUST come from data because
// there is nowhere else to get it, and the effect to be detected must NOT. It
// is stated as the threshold the contract already calls meaningful for an
// outcome win — detect a regression as large as the gain you would celebrate.
//
// usage:
//   node scripts/eval-power-harm-guards.mjs [--skill <id>] [--power 0.8] [--detect 0.1]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

const evidence = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8'));
const attribution = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'assertion-attribution.json'), 'utf8'));
const trials = evidence.minimumEvidence.trialsPerCondition;
const detect = Number(opt('detect', evidence.minimumEvidence.outcomeDeltaRequired));
const power = Number(opt('power', 0.8));
const onlySkill = opt('skill', null);

// Identical to eval-report.mjs's T95, and the same two-sided/one-sided pairing
// eval-power.mjs uses. A one-sided table here would understate the count.
const T95 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045, 30: 2.042 };
const T80 = { 1: 1.376, 2: 0.816, 3: 0.765, 4: 0.741, 5: 0.727, 6: 0.718, 7: 0.711, 8: 0.706, 9: 0.703, 10: 0.700, 11: 0.697, 12: 0.695, 14: 0.692, 15: 0.691, 19: 0.688, 20: 0.687, 24: 0.685, 29: 0.683, 39: 0.681, 59: 0.679, 119: 0.677 };
const lookup = (table, df, floor) => {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b);
  const hit = keys.find((k) => k >= df);
  return hit === undefined ? floor : table[hit];
};

const cases = new Map();
for (const f of fs.readdirSync(path.join(root, 'eval', 'cases-v2')).filter((x) => x.endsWith('.json'))) {
  const p = path.join(root, 'eval', 'cases-v2', f);
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  cases.set(c.id, { c, sha: sha(fs.readFileSync(p)), grader: fs.existsSync(path.join(root, c.grader)) ? sha(fs.readFileSync(path.join(root, c.grader))) : null });
}

// Per case: the harm-guard rate of each recorded skill-arm run, grouped by the
// staged skill digest so two versions of a skill are two samples, not one.
const perCase = new Map();
const seenStatuses = new Map();
const runsDir = path.join(root, 'eval', 'runs');
for (const d of fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : []) {
  const mp = path.join(runsDir, d, 'run.json');
  if (!fs.existsSync(mp)) continue;
  let m; try { m = JSON.parse(fs.readFileSync(mp, 'utf8')); } catch { continue; }
  const rec = cases.get(m.caseId);
  if (!rec || m.exitCode !== 0) continue;
  if (!m.grading || m.grading.notEvaluated !== 0) continue;
  if (m.caseSha256 !== rec.sha || m.graderSha256 !== rec.grader) continue;
  const classes = attribution.cases[m.caseId]?.assertions;
  if (!classes) continue;
  const g = JSON.parse(fs.readFileSync(path.join(runsDir, d, 'grading.json'), 'utf8'));
  const guards = g.assertions.filter((a) => classes[a.id] === 'harm-guard');
  if (!guards.length) continue;
  // Which guards were ever seen to vary, across every arm.
  //
  // A guard that lands the same way everywhere still occupies the denominator,
  // so it rescales the reported effect toward zero while buying no
  // detectability at all: with A varying guards and k fixed ones the measured
  // delta is d*A/(A+k) and the step is 1/((A+k)*T), so effect-in-steps is
  // d*A*T either way. Measured on severity-inflation-pressure, 2026-09-04: the
  // same twelve bundles read -8.3pp over six guards and -16.7pp over the three
  // that vary.
  //
  // That is a rule for DESIGNING a guard — require a mechanism by which it can
  // fail, before it is ever run — and NOT a licence to drop guards afterwards.
  // Pruning on observed flatness picks the denominator after seeing which way
  // it moves, and it inflates: the -16.7pp reading above is what that move
  // buys. So this count is reported as a diagnostic and never substituted for
  // the pre-registered one. Twelve clean runs of a guard is consistent with a
  // true failure rate near one in four; flat is usually a finding about the
  // skill, not a defect in the instrument.
  for (const a of guards) {
    const k = `${m.caseId}\0${a.id}`;
    if (!seenStatuses.has(k)) seenStatuses.set(k, new Set());
    seenStatuses.get(k).add(a.status === 'pass');
  }
  if (m.condition !== 'skill') continue;
  const key = `${m.caseId}\0${m.stagedInputSha256 || 'legacy'}`;
  if (!perCase.has(key)) perCase.set(key, { caseId: m.caseId, skill: rec.c.skill, assertions: guards.length, guardIds: guards.map((a) => a.id), rates: [] });
  perCase.get(key).rates.push(guards.filter((a) => a.status === 'pass').length / guards.length);
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const bySkill = new Map();
for (const v of perCase.values()) {
  if (onlySkill && v.skill !== onlySkill) continue;
  if (!bySkill.has(v.skill)) bySkill.set(v.skill, new Map());
  const m = bySkill.get(v.skill);
  if (!m.has(v.caseId)) m.set(v.caseId, []);
  m.get(v.caseId).push(v);
}

function requiredCases(sigma) {
  for (let n = 2; n <= 400; n++) {
    const df = n - 1;
    const need = (lookup(T95, df, 1.96) + (power === 0.8 ? lookup(T80, df, 0.674) : 0)) * (sigma / Math.sqrt(n));
    if (detect >= need) return n;
  }
  return null;
}

console.log(`detecting a harm-guard regression of ${detect} at ${power} power, ${trials} trials per case\n`);
for (const [skill, caseMap] of bySkill) {
  // Paired deltas need two skill versions of the same case; that exists only
  // where a skill was edited and re-run.
  const paired = [...caseMap.values()].filter((v) => v.length >= 2)
    .map((v) => mean(v[1].rates) - mean(v[0].rates));
  const varyingCounts = [...caseMap.values()].map((v) =>
    v[0].guardIds.filter((id) => (seenStatuses.get(`${v[0].caseId}\0${id}`)?.size ?? 1) > 1).length);
  const assertionCounts = [...caseMap.values()].map((v) => v[0].assertions);
  const resolution = 1 / (Math.min(...assertionCounts) * trials);
  console.log(`==== ${skill}`);
  console.log(`  cases carrying harm guards        ${caseMap.size}`);
  console.log(`  assertions per case               min ${Math.min(...assertionCounts)}, max ${Math.max(...assertionCounts)}`);
  console.log(`  diagnostic: ever seen to vary     min ${Math.min(...varyingCounts)}, max ${Math.max(...varyingCounts)}   (not the denominator — see the note above this line in source)`);
  console.log(`  finest change a case can show     ${(resolution * 100).toFixed(0)}pp   ${resolution > detect ? `<-- LARGER than the ${detect * 100}pp being detected: unrepresentable` : 'ok'}`);
  // A*T must be at least 1/detect for the effect to land on a reachable value.
  const assertionsNeeded = Math.ceil(1 / (detect * trials));
  if (resolution > detect) {
    console.log(`  assertions per case needed        ${assertionsNeeded} at ${trials} trials, for ${(100 / (assertionsNeeded * trials)).toFixed(1)}pp resolution`);
  }
  if (paired.length < 2) {
    console.log('  no paired re-measurement, so no spread to derive from\n');
    continue;
  }
  const m = mean(paired);
  const sd = Math.sqrt(paired.reduce((a, x) => a + (x - m) ** 2, 0) / (paired.length - 1));
  // Zero spread here does not mean the measurement is precise. It means no
  // guard moved in any arm of any case, so there is nothing to estimate a
  // spread from — and feeding sigma = 0 into the sample-size formula returns
  // "two cases will do", which is the opposite of the truth.
  if (sd === 0) {
    console.log('  observed paired spread (SD)       0 — no guard varied in any arm, so there is no');
    console.log('                                    spread to derive from and no case count to state\n');
    continue;
  }
  const n = requiredCases(sd);
  console.log(`  observed paired spread (SD)       ${sd.toFixed(3)}  over ${paired.length} re-measured cases`);
  console.log(`  cases needed at that spread       ${n ?? 'more than 400'}`);
  const df = caseMap.size - 1;
  const half = lookup(T95, df, 1.96) * (sd / Math.sqrt(caseMap.size));
  console.log(`  at the current ${String(caseMap.size).padStart(2)} cases            a regression smaller than ${(half * 100).toFixed(0)}pp cannot be distinguished from zero\n`);
}

console.log('Adding cases cannot fix a resolution problem and adding assertions cannot');
console.log('fix a spread problem. Where the finest representable change already exceeds');
console.log('the effect being detected, more assertions per case is the only lever.');
console.log('');
console.log('The case count above is an UPPER bound. It is derived from a spread measured');
console.log('at 33pp resolution, and most of that spread is the quantisation itself — a');
console.log('case can only move in thirds, so a one-trial flip reads as 33 points. Adding');
console.log('assertions shrinks the spread as well as the step, and the count should be');
console.log('re-derived once the rubrics carry enough guards to measure with.');
