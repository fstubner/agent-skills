#!/usr/bin/env node
// The skill edit, judged on both halves. Old skill-arm runs are identified by
// a stagedInputSha256 that is not the current one; new ones by matching it.
// Policy and control are untouched and shared by both.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const ev = JSON.parse(fs.readFileSync('eval/evidence.json', 'utf8'));
const attr = JSON.parse(fs.readFileSync('eval/assertion-attribution.json', 'utf8'));
const SKILL = 'engineering-assessment';

const cases = new Map();
for (const f of fs.readdirSync('eval/cases-v2').filter((x) => x.endsWith('.json'))) {
  const p = path.join('eval/cases-v2', f);
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (c.skill === SKILL) cases.set(c.id, { c, sha: sha(fs.readFileSync(p)), grader: fs.existsSync(c.grader) ? sha(fs.readFileSync(c.grader)) : null });
}

// Current staged digest = whatever the newest skill runs carry.
const digestCount = new Map();
const runs = [];
for (const d of fs.readdirSync('eval/runs')) {
  const mp = path.join('eval/runs', d, 'run.json');
  if (!fs.existsSync(mp)) continue;
  let m; try { m = JSON.parse(fs.readFileSync(mp, 'utf8')); } catch { continue; }
  const rec = cases.get(m.caseId);
  if (!rec || m.harness !== 'claude-code' || m.exitCode !== 0) continue;
  if (!m.grading || m.grading.notEvaluated !== 0) continue;
  if (m.caseSha256 !== rec.sha || m.graderSha256 !== rec.grader) continue;
  const g = JSON.parse(fs.readFileSync(path.join('eval/runs', d, 'grading.json'), 'utf8'));
  runs.push({ m, g, at: m.startedAt });
  if (m.condition === 'skill') digestCount.set(m.stagedInputSha256, (digestCount.get(m.stagedInputSha256) ?? 0) + 1);
}
const newest = runs.filter((r) => r.m.condition === 'skill').sort((a, b) => b.at.localeCompare(a.at))[0];
const CURRENT = newest.m.stagedInputSha256;

const arm = (r) => (r.m.condition !== 'skill' ? r.m.condition : (r.m.stagedInputSha256 === CURRENT ? 'skill-new' : 'skill-old'));
const rateFor = (runsIn, filter) => {
  const per = [];
  for (const r of runsIn) {
    const rel = r.g.assertions.filter(filter(r.m.caseId));
    if (!rel.length) continue;
    per.push(rel.filter((a) => a.status === 'pass').length / rel.length);
  }
  return per.length ? per.reduce((a, b) => a + b, 0) / per.length : null;
};
const byArm = {};
for (const r of runs) (byArm[arm(r)] ??= []).push(r);

const classFilter = (cls) => (caseId) => (a) => attr.cases[caseId]?.assertions?.[a.id] === cls;
const allFilter = () => () => true;

console.log(`engineering-assessment, claude-code/haiku — runs per arm:`);
for (const [k, v] of Object.entries(byArm)) console.log(`  ${k.padEnd(11)} ${v.length}`);
console.log('\n                    control   policy   skill-OLD   skill-NEW   change');
const row = (label, filter) => {
  const c = rateFor(byArm.control ?? [], filter);
  const p = rateFor(byArm.policy ?? [], filter);
  const o = rateFor(byArm['skill-old'] ?? [], filter);
  const n = rateFor(byArm['skill-new'] ?? [], filter);
  const fmt = (x) => (x === null ? '  --  ' : x.toFixed(3));
  const delta = o !== null && n !== null ? `${((n - o) * 100 >= 0 ? '+' : '')}${((n - o) * 100).toFixed(1)}pp` : '';
  console.log(`  ${label.padEnd(18)} ${fmt(c)}   ${fmt(p)}    ${fmt(o)}      ${fmt(n)}     ${delta}`);
};
row('ALL assertions', allFilter);
for (const cls of ['rule-targeted', 'base-capability', 'harm-guard']) row(cls, classFilter(cls));

console.log('\nthe two rule-targeted assertions a "report less" fix would damage:');
for (const id of ['dead-code-cited', 'absence-of-serious-findings-stated']) {
  const f = () => (a) => a.id === id;
  const o = rateFor((byArm['skill-old'] ?? []).filter((r) => r.m.caseId === 'severity-inflation-pressure'), f);
  const n = rateFor((byArm['skill-new'] ?? []).filter((r) => r.m.caseId === 'severity-inflation-pressure'), f);
  console.log(`  ${id.padEnd(36)} old ${o === null ? '--' : o.toFixed(2)}  ->  new ${n === null ? '--' : n.toFixed(2)}`);
}
console.log('\nseverity-inflation-pressure harm guards, per run:');
for (const k of ['policy', 'skill-old', 'skill-new']) {
  for (const r of (byArm[k] ?? []).filter((x) => x.m.caseId === 'severity-inflation-pressure')) {
    const hg = r.g.assertions.filter((a) => attr.cases[r.m.caseId]?.assertions?.[a.id] === 'harm-guard');
    console.log(`  ${k.padEnd(10)} ${hg.map((a) => `${a.id.replace('no-', '')}=${a.status}`).join('  ')}`);
  }
}
