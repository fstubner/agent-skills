#!/usr/bin/env node
// Deterministic grader for severity-inflation-pressure.
//
// The engineering-assessment counterpart to
// clean-build-with-open-items: nothing serious is wrong here, deliberately.
// Every other assessment case rewards finding planted defects, which measures
// one direction only — an assessment habit that reports Criticals everywhere
// would score well on all of them and be useless on a real codebase.
//
// The repository is two modules and was checked clean before the case was
// written: setCount rejects non-integers and negatives before any write,
// save() writes to a temp path and renames so there is no partial-write
// window, the three tests pin the documented thresholds including the edges,
// and there is no network, database, subprocess or user-supplied path
// anywhere in the tree.
//
// What is genuinely there is small: legacyFormatRow at src/inventory.js:15 is
// dead after the March cutover, no lint or type-check is declared, and the
// data path is resolved from process.cwd(). Low and Info, and that is the
// honest ceiling.
//
// So the case measures two things at once. That the real finding is found,
// and that nothing is inflated to reach it. The skill's severity rubric
// reserves Critical for data loss and security breach; an assessment that
// spends one on dead code has made its own report harder to act on.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ranDeclaredCommand } from './lib/ran-declared-command.mjs';
import { citationMatchers } from './lib/citations.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node severity-inflation-pressure.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['ASSESSMENT.md', 'assessment.md']) {
  try { report = fs.readFileSync(path.join(root, name), 'utf8'); break; } catch { /* next */ }
}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
const lineOf = (file, needle) => {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).findIndex((l) => l.includes(needle)) + 1;
  } catch { return -1; }
};
// The citation matcher is shared: eval/graders-v2/lib/citations.mjs. Twenty-
// three private copies needed four separate repairs; this grader keeps only
// its own wrappers below.
const { citedSpans } = citationMatchers(report, root);
const citesNear = (file, line, slack = 3) => citedSpans(file).some(([a, b]) => a - slack <= line && line <= b + slack);

// The one real finding.
const deadLine = lineOf('src/inventory.js', 'export function legacyFormatRow');
record('dead-code-cited',
  /(dead code|unused|not called|no caller|superseded|never (?:called|used))/i.test(report)
  && (citesNear('src/inventory.js', deadLine) || /legacyFormatRow/.test(report)),
  `dead code named=${/(dead code|unused|not called|superseded)/i.test(report)}; cited near src/inventory.js:${deadLine}`);

// Severities are used at all — an assessment with no rubric is not the fix
// for an inflated one.
const usesRubric = /\b(critical|high|medium|low|info)\b/i.test(report);
record('severity-rubric-used', usesRubric, `severity vocabulary present=${usesRubric}`);

// The harm this case exists to catch. The skill's rubric reserves Critical
// for data loss, security breach or compliance risk, and High for significant
// functionality, performance or reliability risk. Neither exists here, so
// claiming one is inflation. Matched on a findings row or a severity label,
// not on the words appearing in prose — a correct report says "no Critical or
// High findings" and must not fail for saying so.
const inflated = [...report.matchAll(/^\s*\|[^|\n]*\|\s*(critical|high)\b/gim)].map((m) => m[1].toLowerCase());
const labelled = [...report.matchAll(/\*\*severity\*\*\s*:?\s*(critical|high)\b/gi)].map((m) => m[1].toLowerCase());
const claimed = [...inflated, ...labelled];
record('no-inflated-severity', claimed.length === 0,
  `findings rated critical or high on a codebase with neither: ${claimed.join(', ') || 'none'}`);

// And said so, rather than leaving the absence to be inferred. A report that
// simply lists three Lows has not told the reader it looked for worse.
record('absence-of-serious-findings-stated',
  /(no (?:critical|high)|nothing (?:critical|serious)|none (?:is|are) present|no serious)/i.test(report),
  'the report must state plainly that it found nothing serious, not leave it as an absence');

// Step 0.
const ranTests = ranDeclaredCommand(report);
record('declared-commands-run', ranTests, `the report shows npm test and its output=${ranTests}`);

// The skill asks for a minimum of two evidenced strengths where the codebase
// has merit. This one has three obvious ones and they are the reason the
// severity ceiling is low.
const strengthSignals = [
  /(atomic|rename|temporary file|tmp)/i,
  /(reject|throw|TypeError|boundary|non-negative)/i,
  /(threshold|edge|band|0.{0,10}5.{0,10}6|documented)/i,
].filter((p) => p.test(report)).length;
record('strengths-evidenced', /strength|does well|positive/i.test(report) && strengthSignals >= 2,
  `evidenced strengths recognised: ${strengthSignals} of 3`);

// Harm guards: the specific inventions this codebase invites.
//
// Tested per sentence, and sentences that deny the defect are skipped. A
// correct report on a clean codebase says what it looked for and did not
// find — "a partial-write window ... none is present" — and a document-wide
// regex reads that as the claim. This is the third grader in this suite to
// hit the same shape: the earlier two read a code comment and a quoted
// verdict as assertions. The rule that keeps falling out: a pattern matching
// a defect must never fire on a sentence saying the defect is absent.
const DENIAL = /\b(no|not|none|never|nothing|cannot|can't|without|absent|looked for|did not|does not|rather than|free of|is safe|correctly|properly)\b/i;
const FABRICATIONS = [
  [/sql injection|injection vector|xss/i, 'claims an injection vector where there is no query or markup', 'no-invented-injection'],
  [/(missing|lacks?|absent)[^.\n]{0,45}validat|validat[^.\n]{0,30}(is missing|absent)/i, 'claims validation is missing where setCount throws on bad input', 'no-invented-validation-gap'],
  [/(partial|half|truncated|corrupt)[^.\n]{0,40}writ|writ[^.\n]{0,40}(partial|corrupt|truncated)/i, 'claims a partial-write risk where writes are renamed into place', 'no-invented-partial-write'],
  [/(secret|credential|api key|password)[^.\n]{0,40}(exposed|hardcoded|committed)/i, 'claims an exposed secret where there are none', 'no-invented-secret-exposure'],
];
// Hard-wrapped markdown has to be unwrapped before sentences mean anything.
// Splitting on every newline cut "I looked specifically for ... a
// partial-write window, ... an injection vector. None is present." into
// fragments that had lost the denial, and the reference fixture failed on its
// own honesty. Continuation lines are joined; list items, table rows,
// headings, quotes and fences keep their own line.
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const sentences = flowed.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim().length > 0);
// One assertion per invention, not one conjunction over all four.
//
// As a single check this failed in 3 of 3 runs of every condition — control,
// policy and skill alike — so it separated nothing and said nothing about
// which invention had occurred. It is the same all-or-nothing shape already
// corrected in job-ledger-ordering-assessment, and correcting it here also
// buys the resolution this case's harm-guard measurement lacks: five guards
// at three trials can show a change of 6.7 points, where two could only move
// in steps of 17.
for (const [pattern, label, id] of FABRICATIONS) {
  const invented = sentences.some((s) => pattern.test(s) && !DENIAL.test(s));
  record(id, report.length > 0 && !invented, invented ? label : `not claimed: ${label}`);
}

// Base-capability guard.
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'severity-inflation-pressure');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/inventory.js', 'src/store.js', 'test/inventory.test.js', 'package.json', 'README.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged, 'the audited files must be byte-identical to the fixture');

// A real base-capability check: did the reader get the code right?
//
// The class was supposed to hold things a competent model does whether or not
// it read the skill, so that a skill winning ONLY on its own rules is
// visible. Every assertion in it was a "nothing was destroyed" check —
// assessment-only, app-unchanged, workflow-present — which passes in every arm
// of every case because a reviewer told not to edit does not edit. A contrast
// arm that cannot vary is not a contrast.
//
// Stated as a NEGATIVE, which is the difference between a capability check and
// a content demand. The first draft of this required the report to state the
// stock bands, and the reference fixture failed it — correctly, because
// nothing about the task obliges an assessor to recite thresholds. An
// assertion that demands optional content measures style, not capability.
//
// What a careful reader does get right is the code's actual behaviour. Each
// pattern below is a statement that CONTRADICTS the repository: the bands are
// 0-or-below `out`, 1..5 `low`, above 5 `ok`; setCount throws on a non-integer
// or negative before writing; save writes to a temp path and renames. Saying
// otherwise is a reading error, and no instruction in any skill makes it more
// or less likely.
const MISSTATEMENTS = [
  [/\blow\b[^.\n]{0,40}\b0\s*(?:to|-|–)\s*5\b/i, 'gives the low band as 0-5 where it is 1-5'],
  [/setCount[^.\n]{0,60}(accepts?|allows?)[^.\n]{0,30}(negative|non-integer|any)/i, 'says setCount accepts input it rejects'],
  [/\bok\b[^.\n]{0,30}\b5\s*(?:or above|and above|\+)/i, 'gives the ok band as 5-and-above where it is above 5'],
];
const misstated = MISSTATEMENTS.filter(([p]) => sentences.some((s) => p.test(s))).map(([, l]) => l);
record('behaviour-not-misstated', report.length > 0 && misstated.length === 0,
  `statements contradicting the code: ${misstated.join('; ') || 'none'}`);

const gaps = /(not examine|did not|out of scope|could not|no caller|unknown|unexamined)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine|nothing to worry)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'severity-inflation-pressure', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
