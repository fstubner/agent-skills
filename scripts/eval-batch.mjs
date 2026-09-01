#!/usr/bin/env node
// Runs the promotion matrix, resumably. Every cell it needs is
// (case, condition, harness, model) and every cell needs trialsPerCondition
// runs; it counts what is already on disk and only runs the shortfall, so an
// interrupted batch is continued by invoking it again rather than restarted.
//
// Bounded on purpose. --max-runs caps one invocation so a batch cannot
// outrun its supervision — an earlier unbounded batch in this project
// produced 31 bundles when 18 had been reported, and nothing noticed until
// the count was checked afterwards.
//
// usage:
//   node scripts/eval-batch.mjs --skill release-engineering --max-runs 20
//   node scripts/eval-batch.mjs --case plumbing-directory-blindspot --dry-run
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const root = path.resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const dryRun = argv.includes('--dry-run');
const maxRuns = Number(opt('max-runs', '12'));
const onlySkill = opt('skill', null);
const onlyCase = opt('case', null);
const onlyHarness = opt('harness', null);

const evidence = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8'));
const { trialsPerCondition, requiredHarnesses, requiredModelsByHarness } = evidence.minimumEvidence;
const measured = new Set(evidence.measuredSkills);

const cases = fs.readdirSync(path.join(root, 'eval', 'cases-v2'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', f), 'utf8')))
  .filter((c) => measured.has(c.skill))
  .filter((c) => (onlySkill ? c.skill === onlySkill : true))
  .filter((c) => (onlyCase ? c.id === onlyCase : true))
  .sort((a, b) => a.id.localeCompare(b.id));

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const caseGrader = new Map(cases.map((c) => [c.id, path.join(root, c.grader)]));

// What is already recorded. A cell is keyed exactly as the matrix defines it.
const existing = new Map();
const runsDir = path.join(root, 'eval', 'runs');
for (const entry of fs.existsSync(runsDir) ? fs.readdirSync(runsDir) : []) {
  const manifest = path.join(runsDir, entry, 'run.json');
  if (!fs.existsSync(manifest)) continue;
  let m = null;
  try { m = JSON.parse(fs.readFileSync(manifest, 'utf8')); } catch { continue; }
  if (!m.grading) continue;
  // Only runs the CURRENT instrument produced count toward a cell.
  //
  // 322 of the bundles on disk carry no graderSha256 at all — they predate
  // the binding, and eval-verify's check is conditional on the field being
  // there, so they pass without being checked. Twenty graders changed today.
  // Counting those toward the matrix would let the programme report itself
  // complete on gradings that cannot be reproduced, which is the same failure
  // as trusting a stale report file — the thing this suite refuses everywhere
  // else.
  if (!m.graderSha256) continue;
  const graderPath = caseGrader.get(m.caseId);
  if (!graderPath || !fs.existsSync(graderPath)) continue;
  if (m.graderSha256 !== sha256(fs.readFileSync(graderPath))) continue;
  const key = [m.caseId, m.condition, m.harness, m.model].join('|');
  existing.set(key, (existing.get(key) ?? 0) + 1);
}

// The matrix is expanded in flat stages rather than four nested loops, which
// the repo's own nesting check rejects — and it reads better: each stage is
// one dimension of the cell key.
const harnesses = requiredHarnesses.filter((h) => !onlyHarness || h === onlyHarness);
const cells = cases.flatMap((c) => c.conditions.flatMap((condition) =>
  harnesses.flatMap((harness) => (requiredModelsByHarness[harness] ?? [])
    .map((model) => ({ caseId: c.id, condition, harness, model })))));

const shortfall = (cell) => {
  const have = existing.get([cell.caseId, cell.condition, cell.harness, cell.model].join('|')) ?? 0;
  return Array.from({ length: Math.max(0, trialsPerCondition - have) },
    (_, i) => ({ ...cell, trial: have + i + 1, of: trialsPerCondition }));
};
const wanted = cells.flatMap(shortfall);

console.log(`cells short of ${trialsPerCondition} trials: ${wanted.length} runs outstanding`);
if (dryRun || wanted.length === 0) {
  const byCase = {};
  for (const w of wanted) byCase[w.caseId] = (byCase[w.caseId] ?? 0) + 1;
  for (const [k, v] of Object.entries(byCase)) console.log(`  ${k}: ${v}`);
  process.exit(0);
}

const todo = wanted.slice(0, maxRuns);
console.log(`running ${todo.length} of them this invocation\n`);

let ok = 0;
let failed = 0;
for (const [i, w] of todo.entries()) {
  const args = ['scripts/eval-run.mjs', '--case', w.caseId, '--condition', w.condition,
    '--harness', w.harness, '--model', w.model];
  if (w.harness === 'codex') args.push('--codex-container');
  const started = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 900_000 });
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  let grading = null;
  try { grading = JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).grading; } catch { /* below */ }
  // Success is "a graded bundle exists", not "the process exited 0".
  // eval-run.mjs exits 1 whenever any assertion failed, which is the normal
  // outcome for a control arm — the first batch reported 10 consecutive RUN
  // FAILED for runs that had completed and scored 3/12.
  if (grading) {
    ok += 1;
    console.log(`[${i + 1}/${todo.length}] ${w.caseId} ${w.condition}/${w.harness} t${w.trial} -> ${grading.passed}/${grading.total} (${secs}s)`);
  } else {
    failed += 1;
    console.log(`[${i + 1}/${todo.length}] ${w.caseId} ${w.condition}/${w.harness} t${w.trial} -> RUN FAILED exit=${r.status} (${secs}s)`);
    const err = (r.stderr || '').trim().split('\n').slice(-2).join(' | ');
    if (err) console.log(`      ${err.slice(0, 200)}`);
  }
}
console.log(`\ncompleted ${ok}, failed ${failed}, ${wanted.length - todo.length} still outstanding`);
