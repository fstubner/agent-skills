#!/usr/bin/env node
// Score archived run bundles with a grader, without spending a single run.
//
// Why this exists. Repairing a rubric means adding assertions, and an
// assertion that cannot fail is worse than no assertion: it shrinks the
// measurement step (good) while dragging every arm's rate toward 1 (bad), so
// it buys resolution by burying the effect. The only way to know which one a
// new assertion is, before spending nine runs on it, is to score it against
// output that already exists. Every bundle keeps `outputs/` — a copy of the
// workspace the harness left behind — and a grader reads exactly that.
//
// This was done by hand three times (the citation fixes, the four minified
// graders, the severity-inflation split) before it became a script.
//
// FIDELITY IS CHECKED, NOT ASSUMED. `outputs/` is a copy with `.git`,
// `node_modules`, `.agent-evidence`, `.agent-input`, `.codex` and `.claude`
// removed, so a grader that reads any of those scores a bundle differently
// than it scored the live workspace. Every run whose stored graderSha256
// matches the grader being run is re-scored and compared against its own
// recorded grading.json; a difference means the bundle does not reproduce and
// its rows are excluded from the table rather than quietly counted. Without
// that check this tool would happily report that an assertion "never fails"
// when what actually happened is that the file it looks for was not copied.
//
// usage:
//   node scripts/eval-regrade.mjs --case <id> [--grader <path>] [--eval-root <dir>] [--json]
//     --grader   score with this grader instead of the case's current one
//     --json     emit the per-assertion table as JSON
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { runEligibility } from './lib/eval-eligibility.mjs';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');

const caseId = opt('case');
if (!caseId) {
  console.error('usage: node scripts/eval-regrade.mjs --case <id> [--grader <path>] [--eval-root <dir>] [--json]');
  process.exit(2);
}

const evalRoot = path.resolve(root, opt('eval-root') ?? path.join(root, 'eval'));

const caseFile = fs.readdirSync(path.join(evalRoot, 'cases-v2'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.join(evalRoot, 'cases-v2', f))
  .find((p) => JSON.parse(fs.readFileSync(p, 'utf8')).id === caseId);
if (!caseFile) { console.error(`no case with id ${caseId}`); process.exit(2); }
const testCase = JSON.parse(fs.readFileSync(caseFile, 'utf8'));

const graderPath = path.resolve(root, opt('grader') ?? testCase.grader);
if (!fs.existsSync(graderPath)) { console.error(`grader not found: ${graderPath}`); process.exit(2); }
const graderSha = sha256(fs.readFileSync(graderPath));

// Superseded bundles are included on purpose: they are the evidence a rubric
// repair is judged against, and they were moved out of eval/runs precisely
// because the grader changed.
const bundleDirs = [];
const skipped = [];
for (const dir of ['runs', 'runs-superseded']) {
  const base = path.join(evalRoot, dir);
  if (!fs.existsSync(base)) continue;
  for (const d of fs.readdirSync(base)) {
    const mp = path.join(base, d, 'run.json');
    if (!fs.existsSync(mp)) continue;
    let m; try { m = JSON.parse(fs.readFileSync(mp, 'utf8')); } catch { continue; }
    if (m.caseId !== caseId) continue;
    if (!fs.existsSync(path.join(base, d, 'outputs'))) continue;
    // The same gate eval-report uses. Without it a 429 run — nothing evaluated,
    // workspace untouched — regrades as a wall of honest-looking failures, and
    // a new assertion would be judged against output no model ever produced.
    const transcriptPath = path.join(base, d, 'transcript.jsonl');
    const ineligible = runEligibility({
      testCase,
      manifest: m,
      transcript: fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '',
    });
    if (ineligible) { skipped.push({ dir: d, reason: ineligible }); continue; }
    bundleDirs.push({ dir: path.join(base, d), manifest: m, archived: dir === 'runs-superseded' });
  }
}
if (!bundleDirs.length) { console.error(`no bundles with outputs/ for ${caseId}`); process.exit(1); }

function score(outputsDir) {
  const r = spawnSync(process.execPath, [graderPath, '--root', outputsDir], {
    cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 20 * 1024 * 1024,
  });
  try { return { ok: true, grading: JSON.parse(r.stdout) }; }
  catch { return { ok: false, error: (r.stderr || '').trim().split('\n').slice(-3).join(' | ') || `grader exit ${r.status}` }; }
}

const rows = [];
const unfaithful = [];
const broken = [];
for (const b of bundleDirs) {
  const scored = score(path.join(b.dir, 'outputs'));
  if (!scored.ok) { broken.push({ dir: path.basename(b.dir), error: scored.error }); continue; }
  const statuses = new Map(scored.grading.assertions.map((a) => [a.id, a.status]));

  // The reproduction check. Only meaningful when the stored verdict came from
  // this exact grader; otherwise a difference is the point of the exercise.
  if (b.manifest.graderSha256 === graderSha) {
    const storedPath = path.join(b.dir, 'grading.json');
    if (fs.existsSync(storedPath)) {
      const stored = JSON.parse(fs.readFileSync(storedPath, 'utf8'));
      const differs = stored.assertions.filter((a) => statuses.get(a.id) !== a.status);
      if (differs.length) {
        unfaithful.push({ dir: path.basename(b.dir), differs: differs.map((a) => `${a.id}: ${a.status} -> ${statuses.get(a.id) ?? 'absent'}`) });
        continue;
      }
    }
  }
  rows.push({ condition: b.manifest.condition, archived: b.archived, statuses });
}

const conditions = ['control', 'policy', 'checker', 'skill'].filter((c) => rows.some((r) => r.condition === c));
const assertionIds = [...new Set(rows.flatMap((r) => [...r.statuses.keys()]))];
const table = assertionIds.map((id) => {
  const byCondition = {};
  for (const c of conditions) {
    const seen = rows.filter((r) => r.condition === c && r.statuses.has(id));
    byCondition[c] = { pass: seen.filter((r) => r.statuses.get(id) === 'pass').length, of: seen.length };
  }
  const all = rows.filter((r) => r.statuses.has(id));
  const passes = all.filter((r) => r.statuses.get(id) === 'pass').length;
  return {
    id,
    byCondition,
    discriminates: passes !== 0 && passes !== all.length,
    verdict: passes === all.length ? 'ALWAYS PASSES' : passes === 0 ? 'never passes' : null,
  };
});

if (args.includes('--json')) {
  console.log(JSON.stringify({ caseId, grader: path.relative(root, graderPath), graderSha256: graderSha, scored: rows.length, skipped, unfaithful, broken, table }, null, 2));
} else {
  console.log(`${caseId} scored by ${path.relative(root, graderPath)}`);
  console.log(`  ${rows.length} bundles scored (${rows.filter((r) => r.archived).length} superseded), ${skipped.length} ineligible, ${unfaithful.length} did not reproduce, ${broken.length} grader failures\n`);
  const w = Math.max(...assertionIds.map((i) => i.length));
  console.log('  ' + 'assertion'.padEnd(w) + conditions.map((c) => c.padStart(10)).join('') + '   ');
  for (const t of table) {
    const cells = conditions.map((c) => `${t.byCondition[c].pass}/${t.byCondition[c].of}`.padStart(10)).join('');
    console.log('  ' + t.id.padEnd(w) + cells + (t.verdict ? `   <-- ${t.verdict}` : ''));
  }
  if (unfaithful.length) {
    console.log('\n  DID NOT REPRODUCE — excluded from the table above:');
    for (const u of unfaithful) console.log(`    ${u.dir}\n      ${u.differs.join('\n      ')}`);
  }
  if (broken.length) {
    console.log('\n  grader failed on:');
    for (const b of broken) console.log(`    ${b.dir}: ${b.error}`);
  }
}
