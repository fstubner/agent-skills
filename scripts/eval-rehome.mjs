#!/usr/bin/env node
// Return a superseded control or policy bundle to eval/runs by re-scoring its
// archived output with the grader that superseded it.
//
// WHY THIS IS SOUND FOR TWO CONDITIONS AND NOT THE OTHER TWO. A run bundle
// binds four things: the case, the fixture, what was staged into the
// workspace, and the grader that read the result. A grader repair invalidates
// the fourth and nothing else. For control and policy the suite stages
// nothing at all — stagedInputSha256 is null by construction — so the task
// the model performed is byte-identical to the task it would perform today,
// and the only reason those bundles were archived is that a different grader
// would now read them. Re-scoring recovers exactly what was lost.
//
// A skill or checker arm is not recoverable that way. Those bundles were
// superseded on 2026-09-06 because staging itself changed: the skill arm now
// receives a vendored core and a package.json it did not have, and its
// checker could not execute before that. Re-scoring output produced under the
// old staging would score the old treatment and file it as the new one. So
// this refuses those conditions outright rather than offering a flag.
//
// WHAT IT COSTS. The re-homed bundle's grading did not come from its own run.
// That is recorded in run.json under `regrade`, which no bundle written by
// eval-run.mjs carries, so "scored by the grader present at the time" and
// "scored later by a grader proven to read the same output" stay separable
// forever. Every other digest is re-checked here before anything moves; a
// bundle whose fixture, case, checker or outputs have shifted is refused,
// because then the grader is not the only thing that changed.
//
// usage:
//   node scripts/eval-rehome.mjs --case <id> [--dry-run]
//   node scripts/eval-rehome.mjs --all [--dry-run]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import { hashTree, sha256 } from './lib/tree-hash.mjs';
import { runEligibility } from './lib/eval-eligibility.mjs';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const dryRun = args.includes('--dry-run');
const caseId = opt('case');
const all = args.includes('--all');
const TOOL = 'scripts/eval-rehome.mjs';
// Control and policy stage nothing, so a grader repair is the only thing that
// can have changed underneath them. Nothing else is re-homeable; see above.
const REHOMEABLE = new Set(['control', 'policy']);

if (!caseId && !all) {
  console.error('usage: node scripts/eval-rehome.mjs (--case <id> | --all) [--dry-run]');
  process.exit(2);
}

const hashFile = (p) => sha256(fs.readFileSync(p));
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// --eval-root exists so the refusal rules can be exercised against a
// synthetic corpus. The rules are the whole point of this tool, and testing
// them against eval/ would mean moving real evidence to find out.
const evalRoot = path.resolve(root, opt('eval-root') ?? path.join(root, 'eval'));

const cases = new Map(fs.readdirSync(path.join(evalRoot, 'cases-v2'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const raw = fs.readFileSync(path.join(evalRoot, 'cases-v2', f));
    const value = JSON.parse(raw);
    return [value.id, { value, sha: sha256(raw) }];
  }));

// Every reason a bundle is not re-homeable, in one place. Each clause names a
// digest that would otherwise be silently re-blessed by moving the directory.
function refusal(dir, manifest, entry) {
  if (!REHOMEABLE.has(manifest.condition)) {
    return `${manifest.condition} arm: staging changed too, so re-scoring would file the old treatment as the new one`;
  }
  if (manifest.stagedInputSha256) return 'staged an input, so it is not a bare control/policy run';
  // Bundles predating graderSha256 are unbound, and this tool's whole claim is
  // "the grader is the only thing that changed". With no record of which
  // grader scored it, that claim cannot be made about this bundle by anyone.
  if (!manifest.graderSha256) return 'no recorded grader, so there is no way to say the grader is the only thing that moved';
  if (!entry) return `no case with id ${manifest.caseId}`;
  if (manifest.caseSha256 !== entry.sha) return 'case content has changed since the run';
  if (!fs.existsSync(path.join(dir, 'outputs'))) return 'no outputs/ to score';
  if (manifest.artifactSha256 !== hashTree(path.join(dir, 'outputs'))) return 'outputs no longer match the recorded artifact hash';

  const fixtureDir = entry.value.fixture ? path.resolve(root, entry.value.fixture) : null;
  if (manifest.fixtureSha256 && fixtureDir && fs.existsSync(fixtureDir)
    && manifest.fixtureSha256 !== hashTree(fixtureDir)) return 'fixture content has changed since the run';

  const checkerFile = entry.value.checker ? path.resolve(root, entry.value.checker) : null;
  if (manifest.checkerSha256 && checkerFile && fs.existsSync(checkerFile)
    && manifest.checkerSha256 !== hashFile(checkerFile)) return 'checker content has changed since the run';

  // Archived output is a FILTERED copy of the workspace, and for a long time
  // the filter dropped .agent-evidence/. The repaired runtime-evidence clause
  // reads exactly that directory, so scoring such a copy answers "was there a
  // gate report" with the filter's answer instead of the run's. A fixture that
  // plants one is the case where that is detectable, and it is refused.
  if (fixtureDir && fs.existsSync(path.join(fixtureDir, '.agent-evidence'))
    && !fs.existsSync(path.join(dir, 'outputs', '.agent-evidence'))) {
    return 'outputs/ was archived without the .agent-evidence the fixture plants; re-scoring would read the filter, not the run';
  }

  const transcriptPath = path.join(dir, 'transcript.jsonl');
  const ineligible = runEligibility({
    runDir: dir,
    fixtureDir: fixtureDir ?? undefined,
    testCase: entry.value,
    manifest,
    transcript: fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : '',
  });
  if (ineligible) return `ineligible: ${ineligible}`;
  return null;
}

function score(graderPath, outputsDir) {
  const r = spawnSync(process.execPath, [graderPath, '--root', outputsDir], {
    cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 20 * 1024 * 1024,
  });
  try { return { ok: true, grading: JSON.parse(r.stdout) }; }
  catch { return { ok: false, error: (r.stderr || '').trim().split('\n').slice(-2).join(' | ') || `grader exit ${r.status}` }; }
}

const supersededDir = path.join(evalRoot, 'runs-superseded');
const runsDir = path.join(evalRoot, 'runs');
const moved = [];
const refused = [];

for (const name of fs.existsSync(supersededDir) ? fs.readdirSync(supersededDir).sort() : []) {
  const dir = path.join(supersededDir, name);
  const manifestPath = path.join(dir, 'run.json');
  if (!fs.existsSync(manifestPath)) continue;
  let manifest;
  try { manifest = readJson(manifestPath); } catch { continue; }
  if (caseId && manifest.caseId !== caseId) continue;

  const entry = cases.get(manifest.caseId);
  const why = refusal(dir, manifest, entry);
  if (why) { refused.push({ name, why }); continue; }

  const graderPath = path.resolve(root, entry.value.grader);
  const graderSha = hashFile(graderPath);
  // A bundle already bound to today's grader was archived for some other
  // reason — a case revision, a quarantine, a harness fault. This tool only
  // knows how to undo a grader change, so it leaves those where they are
  // rather than re-blessing an archival decision it cannot see.
  if (manifest.graderSha256 === graderSha) {
    refused.push({ name, why: 'already bound to the current grader; archived for some other reason' });
    continue;
  }
  const scored = score(graderPath, path.join(dir, 'outputs'));
  if (!scored.ok) { refused.push({ name, why: `grader failed: ${scored.error}` }); continue; }

  // The same shape check eval-verify applies, made here so a bundle that
  // would fail verification never reaches eval/runs in the first place.
  const expected = entry.value.assertions.map((a) => a.id).sort().join('\0');
  const actual = scored.grading.assertions.map((a) => a.id).sort().join('\0');
  if (expected !== actual) { refused.push({ name, why: 'grader assertion ids differ from the case' }); continue; }

  const counts = {
    passed: scored.grading.assertions.filter((a) => a.status === 'pass').length,
    failed: scored.grading.assertions.filter((a) => a.status === 'fail').length,
    notEvaluated: scored.grading.assertions.filter((a) => a.status === 'not_evaluated').length,
    total: scored.grading.assertions.length,
  };
  const before = manifest.grading;
  moved.push({ name, condition: manifest.condition, from: `${before.passed}/${before.total}`, to: `${counts.passed}/${counts.total}` });
  if (dryRun) continue;

  const updated = {
    ...manifest,
    graderSha256: graderSha,
    grading: counts,
    regrade: {
      at: new Date().toISOString(),
      tool: TOOL,
      fromGraderSha256: manifest.graderSha256,
      condition: manifest.condition,
    },
  };
  fs.writeFileSync(path.join(dir, 'grading.json'), `${JSON.stringify(scored.grading, null, 2)}\n`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
  fs.renameSync(dir, path.join(runsDir, name));
}

for (const r of refused) console.log(`skip  ${r.name}: ${r.why}`);
for (const m of moved) console.log(`${dryRun ? 'would rehome' : 'rehomed'}  ${m.name} [${m.condition}] ${m.from} -> ${m.to}`);
console.log(`\n${dryRun ? 'would rehome' : 'rehomed'} ${moved.length}, skipped ${refused.length}`);
if (!dryRun && moved.length) console.log('run scripts/eval-verify.mjs before committing');
