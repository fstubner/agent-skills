#!/usr/bin/env node
// usage: node scripts/eval-attribution-split.mjs
//
// Does the skill win only on the rules it states, or on independent capability too?
//
// eval/assertion-attribution.json pre-registered every assertion as
// rule-targeted (the skill tells you to do this), base-capability (a competent
// model should do it regardless) or harm-guard, on 2026-08-31 — before this
// arm was run. This splits the arm-1 result along that line.
//
// A skill that wins only on rule-targeted assertions is measuring compliance
// with its own instructions. A skill that also wins on base-capability is
// doing something a plain rubric would credit.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ev = JSON.parse(fs.readFileSync('eval/evidence.json', 'utf8'));
const attr = JSON.parse(fs.readFileSync('eval/assertion-attribution.json', 'utf8'));
const measured = new Set(ev.measuredSkills);
const HARNESS = 'claude-code';
const MODEL = 'claude-haiku-4-5-20251001';

const cases = new Map();
for (const f of fs.readdirSync('eval/cases-v2').filter((x) => x.endsWith('.json'))) {
  const p = path.join('eval/cases-v2', f);
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (measured.has(c.skill)) cases.set(c.id, { c, sha: sha(fs.readFileSync(p)), grader: fs.existsSync(c.grader) ? sha(fs.readFileSync(c.grader)) : null });
}

// caseId|condition -> { class -> {pass, total} }
const cells = new Map();
for (const d of fs.readdirSync('eval/runs')) {
  const mp = path.join('eval/runs', d, 'run.json');
  if (!fs.existsSync(mp)) continue;
  let m; try { m = JSON.parse(fs.readFileSync(mp, 'utf8')); } catch { continue; }
  const rec = cases.get(m.caseId);
  if (!rec || m.harness !== HARNESS || m.model !== MODEL) continue;
  if (m.exitCode !== 0 || !m.grading || m.grading.notEvaluated !== 0) continue;
  if (m.caseSha256 !== rec.sha || m.graderSha256 !== rec.grader) continue;
  const classes = attr.cases[m.caseId]?.assertions;
  if (!classes) continue;
  const g = JSON.parse(fs.readFileSync(path.join('eval/runs', d, 'grading.json'), 'utf8'));
  const key = `${m.caseId}|${m.condition}`;
  if (!cells.has(key)) cells.set(key, {});
  const cell = cells.get(key);
  for (const a of g.assertions) {
    const cls = classes[a.id];
    if (!cls) continue;
    cell[cls] ??= { pass: 0, total: 0 };
    cell[cls].total++;
    if (a.status === 'pass') cell[cls].pass++;
  }
}

const rate = (caseId, condition, cls) => {
  const c = cells.get(`${caseId}|${condition}`)?.[cls];
  return c && c.total ? c.pass / c.total : null;
};
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const T95 = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145 };
const ci = (xs) => {
  if (xs.length < 2) return null;
  const m = mean(xs);
  const sd = Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
  const h = (T95[xs.length - 1] ?? 1.96) * (sd / Math.sqrt(xs.length));
  return { m, lo: m - h, hi: m + h, n: xs.length };
};

for (const skill of ev.measuredSkills) {
  const ids = [...cases.values()].filter((x) => x.c.skill === skill).map((x) => x.c.id);
  console.log(`\n==== ${skill}`);
  for (const cls of ['rule-targeted', 'base-capability', 'harm-guard']) {
    const deltas = [];
    let assertions = 0;
    for (const id of ids) {
      const s = rate(id, 'skill', cls), p = rate(id, 'policy', cls);
      if (s === null || p === null) continue;
      deltas.push(s - p);
      assertions += cells.get(`${id}|skill`)[cls].total;
    }
    if (!deltas.length) { console.log(`  ${cls.padEnd(16)} no cases carry this class`); continue; }
    const i = ci(deltas);
    const line = i
      ? `mean ${(i.m * 100).toFixed(1).padStart(6)}pp  95% CI [${(i.lo * 100).toFixed(1)}, ${(i.hi * 100).toFixed(1)}]`
      : `single case, delta ${(deltas[0] * 100).toFixed(1)}pp`;
    console.log(`  ${cls.padEnd(16)} ${String(deltas.length).padStart(2)} cases  ${line}`);
  }
}
