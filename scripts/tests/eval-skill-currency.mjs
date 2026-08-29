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
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const node = process.execPath;

const reportNow = () => {
  const r = spawnSync(node, [path.join(root, 'scripts', 'eval-report.mjs')], { cwd: root, encoding: 'utf8' });
  try { return JSON.parse(r.stdout); } catch { return null; }
};
const currencyReasons = (skill) =>
  (skill?.reasons ?? []).filter((reason) => /skill text has changed since/.test(reason));

// A skill whose evidence currently matches its text, so the flag can flip.
const SKILL = 'engineering-assessment';
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
