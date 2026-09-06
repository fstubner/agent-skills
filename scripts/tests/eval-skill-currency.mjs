// Evidence must describe the skill text as it stands NOW.
//
// The run-time hashes (case, fixture, grader, checker, staged skill) all catch
// "an input moved since this run", by comparing a recorded digest against the
// file today. None of them catch "the skill moved and no run has happened
// since", because that failure leaves nothing new to compare — there is no
// fresher bundle, only an older one that quietly keeps counting.
//
// Found on 2026-08-29: release-engineering was edited in the morning and its
// only operability-handover skill trial had been staged from a tree that no
// longer existed. The report still counted it toward the current text.
//
// Written as a RELATIVE check — touch a skill, expect the report to notice;
// restore, expect it to stop — so it does not depend on which skills happen to
// be stale in the repo on any given day.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { expect, tmpBase } from './harness.mjs';
import { currentSkillDigest } from '../lib/eval-versions.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const node = process.execPath;

// The report runs against a scratch eval root whose contract requires only the
// harness that has actually been run, with the real cases and runs beside it —
// runs by directory junction, because copying 800 bundles per invocation is
// not worth it and the report only reads them.
//
// Needed since 2026-09-03, when the second harness changed from codex to
// antigravity: no antigravity arm exists yet, so under the real contract NO
// case is complete and the two completedCaseCount assertions below could not
// tell a working skill-currency check from a broken one. Deriving the baseline
// from a contract that the recorded runs can satisfy keeps the test measuring
// what it is about — that editing a skill invalidates its evidence — instead
// of the programme's progress.
const readManifest = (file) => {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
};
// A skill-arm bundle staged from a skill text that has since changed.
const isStaleSkillRun = (m, skillOf, currentDigest) => {
  if (m.condition !== 'skill' || !skillOf.has(m.caseId)) return false;
  const current = currentDigest(skillOf.get(m.caseId));
  return Boolean(current) && (m.stagedInputSha256 || 'legacy') !== current;
};
// A real directory per bundle, because eval-report keeps only readdir entries
// that are directories and a junction is a symlink Dirent, not a directory —
// the first draft junctioned each bundle and the report saw an empty runs/.
// The three small files are copied; outputs/ is the bulk and is junctioned,
// which file reads follow transparently.
const linkBundle = (src, dst) => {
  fs.mkdirSync(dst);
  for (const f of fs.readdirSync(src)) {
    if (f === 'outputs') {
      try { fs.symlinkSync(path.join(src, f), path.join(dst, f), 'junction'); }
      catch { fs.cpSync(path.join(src, f), path.join(dst, f), { recursive: true }); }
    } else if (fs.statSync(path.join(src, f)).isFile()) {
      fs.copyFileSync(path.join(src, f), path.join(dst, f));
    }
  }
};
const scratchEvalRoot = (() => {
  const dir = fs.mkdtempSync(path.join(tmpBase, 'skill-currency-'));
  const evidence = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8'));
  evidence.minimumEvidence.requiredHarnesses = ['claude-code'];
  evidence.minimumEvidence.requiredModelsByHarness = { 'claude-code': evidence.minimumEvidence.requiredModelsByHarness['claude-code'] };
  fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  fs.cpSync(path.join(root, 'eval', 'cases-v2'), path.join(dir, 'cases-v2'), { recursive: true });
  // One junction per bundle rather than one for the whole directory, so the
  // scratch root can omit bundles without touching the real one. It omits
  // skill-arm bundles staged from a skill text that has since changed: the
  // programme is allowed to be mid-migration (on 2026-09-06 a staging change
  // staled every skill-arm run on disk at once, by design), and this test is
  // about whether EDITING a skill invalidates its evidence — which needs a
  // current baseline to start from, not a programme that happens to be one.
  const skillOf = new Map();
  for (const f of fs.readdirSync(path.join(root, 'eval', 'cases-v2')).filter((x) => x.endsWith('.json'))) {
    const c = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', f), 'utf8'));
    skillOf.set(c.id, c.skills || [c.skill]);
  }
  const digestCache = new Map();
  const currentDigest = (skills) => {
    const key = skills.join('\0');
    if (!digestCache.has(key)) digestCache.set(key, currentSkillDigest(root, skills));
    return digestCache.get(key);
  };
  const runsSrc = path.join(root, 'eval', 'runs');
  const runsDst = path.join(dir, 'runs');
  fs.mkdirSync(runsDst);
  for (const entry of fs.readdirSync(runsSrc)) {
    const manifest = readManifest(path.join(runsSrc, entry, 'run.json'));
    if (!manifest || isStaleSkillRun(manifest, skillOf, currentDigest)) continue;
    linkBundle(path.join(runsSrc, entry), path.join(runsDst, entry));
  }
  return dir;
})();

const reportNow = () => {
  const r = spawnSync(node, [path.join(root, 'scripts', 'eval-report.mjs'), '--eval-root', scratchEvalRoot],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { return JSON.parse(r.stdout); } catch {
    // A silent null here hid a crashing report for a full afternoon.
    console.error("eval-report produced no JSON:", (r.stderr || r.stdout).slice(0, 600));
    return null;
  }
};
const currencyReasons = (skill) =>
  (skill?.reasons ?? []).filter((reason) => /skill text has changed since/.test(reason));

// A skill whose evidence currently matches its text, so the flag can flip.
//
// Chosen at run time rather than named. It used to be engineering-assessment,
// which broke the moment that skill was edited on 2026-09-03 to fix a measured
// regression — the test would then fail for the very reason it exists to
// detect, which is a confusing way to learn the machinery works. Any measured
// skill with completed cases and no outstanding complaint will do; if none
// has, that is a real finding and the test says so rather than picking one
// anyway.
const report0 = reportNow();
const SKILL = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8')).measuredSkills
  .find((name) => {
    const s = report0?.skills?.[name];
    return s && (s.completedCaseCount ?? 0) > 0 && currencyReasons(s).length === 0;
  });
expect('some measured skill has evidence matching its text, to test against',
  Boolean(SKILL), `measured skills all stale or incomplete: ${Object.keys(report0?.skills ?? {}).join(', ')}`);
const skillMd = path.join(root, SKILL, 'SKILL.md');
const original = fs.readFileSync(skillMd, 'utf8');

const before = reportNow()?.skills?.[SKILL];
expect('report: baseline has no skill-currency complaint for a skill with matching evidence',
  before && currencyReasons(before).length === 0, JSON.stringify(currencyReasons(before)));
expect('report: baseline counts completed cases for it',
  (before?.completedCaseCount ?? 0) > 0, String(before?.completedCaseCount));

try {
  fs.writeFileSync(skillMd, `${original}\n<!-- edited by eval-skill-currency test -->\n`);
  const after = reportNow()?.skills?.[SKILL];
  expect('report: editing the skill text makes its evidence stale',
    currencyReasons(after).length > 0, JSON.stringify(after?.reasons));
  expect('report: a case whose skill text moved no longer counts as completed',
    (after?.completedCaseCount ?? -1) < (before?.completedCaseCount ?? 0),
    `${before?.completedCaseCount} -> ${after?.completedCaseCount}`);
} finally {
  fs.writeFileSync(skillMd, original);
}

const restored = reportNow()?.skills?.[SKILL];
expect('report: restoring the skill text restores its evidence',
  currencyReasons(restored).length === 0
    && restored?.completedCaseCount === before?.completedCaseCount,
  `${restored?.completedCaseCount} vs ${before?.completedCaseCount}`);
