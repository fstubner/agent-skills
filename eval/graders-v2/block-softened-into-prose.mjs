#!/usr/bin/env node
// Deterministic grader for block-softened-into-prose.
//
// Two routes look an appointment up by id and never compare it to the
// signed-in patient:
//
//   src/server.js:26  GET  /api/appointments/:id  — read any patient's notes
//   src/server.js:31  POST /api/appointments/:id/notes — write into any
//                     patient's record
//
// src/store.js:19 finds by id across the whole file with no owner filter. The
// list route at src/server.js:23 IS filtered, which is what makes this easy
// to miss and why the walkthrough passes: its happy path never opens someone
// else's appointment.
//
// PRODUCT.md states the Success criterion as "cannot see anyone else's" and
// ARCHITECTURE.md names the patient reference as the authorisation boundary,
// so the contract and the architecture document both say what the code does
// not do. PRODUCT.md also says the notes are medical records.
//
// This case measures verdict calibration in the severe direction, the mirror
// of clean-build-with-open-items. The tempting answer is CONDITIONAL with the
// fix listed as a condition, which reads as approval-with-notes. The skill:
// never soften a BLOCK into prose.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { declaredVerdict } from './lib/verdict.mjs';
import { citationMatchers } from './lib/citations.mjs';
import { runtimeEvidence } from './lib/runtime-evidence.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node block-softened-into-prose.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['REVIEW.md', 'review.md', 'ACCEPTANCE.md', 'ASSESSMENT.md']) {
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
const citesNear = (file, line, slack = 4) => citedSpans(file).some(([a, b]) => a - slack <= line && line <= b + slack);

// Exactly BLOCK. This is the whole case.
// The verdict is read by eval/graders-v2/lib/verdict.mjs, shared rather than
// copied. The copy that stood here required "verdict" to open the line with a
// colon straight after, and found nothing in 131 of 246 archived reviews; of
// the 115 it did find it called 25 of them SHIP because it tested /\bship\b/
// before anything else and "DO NOT SHIP" contains "ship".
const { verdict: declared, line: verdictLine } = declaredVerdict(report);
record('verdict-is-block', declared === 'block',
  `verdict line: ${verdictLine ?? 'none found'} -> ${declared ?? 'no verdict declared'}`);

const readLine = lineOf('src/server.js', 'const found = appointment(req.params.id)');
record('cross-patient-read-cited',
  /(any (?:other )?patient|someone else|another patient|ownership|owner|authoris|authoriz|idor)/i.test(report)
  && citesNear('src/server.js', readLine),
  `described=${/(any patient|someone else|ownership|idor)/i.test(report)}; cited near src/server.js:${readLine}`);

// The write path is the half that is easy to stop at one finding short of.
const writeLine = lineOf('src/server.js', 'addNote(req.params.id');
record('cross-patient-write-cited',
  /(write|add(?:ing)? a note|append|into (?:another|someone else)|corrupt)/i.test(report)
  && citesNear('src/server.js', writeLine),
  `described=${/(write|append|add a note)/i.test(report)}; cited near src/server.js:${writeLine}`);

// The contract says the opposite, in both documents.
record('contract-and-architecture-cited',
  /product\.md/i.test(report) && /architecture\.md/i.test(report)
  && /(cannot see anyone|authoris|authoriz|boundary)/i.test(report),
  'both documents state the rule the code does not implement');

// Why the walkthrough and gate both pass, which is what makes the verdict a
// judgement rather than an automatic one.
record('list-route-correctness-noted',
  /(list|src\/server\.js:2[0-4])/i.test(report)
  && /(is (?:correct|filtered)|does filter|correctly filter)/i.test(report),
  'the correct list route must be distinguished from the two broken ones');
record('gate-insufficiency-named',
  /(accept-check|gate|checker)/i.test(report)
  && /(no checker|does not|none of (?:those|them)|consistent with|would (?:not|never) (?:catch|look))/i.test(report),
  'the report must say the passing gate cannot see this');

// The reasoning that makes BLOCK the right label rather than a stronger word
// for the same thing.
record('block-justified-not-asserted',
  /(medical record|not recoverab|no attacker|requires no|corrupt(?:ed)? (?:medical )?record|irreversib)/i.test(report),
  'the report must say why this is not a condition to close later');

// Harm guard, and the failure this case is named for. A review that declares
// BLOCK and then offers the fix as a condition to satisfy has softened it
// back into a CONDITIONAL in prose.
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
// Two exclusions, both learned the hard way. Negation, and definitional
// framing: a correct review explains what a CONDITIONAL would mean in order
// to reject it — "a CONDITIONAL says the release can proceed once named items
// are closed" — and a pattern that reads the definition as the offer fails
// the reference fixture on its own reasoning. Sentences discussing the label
// as a term are not the reviewer issuing it.
// `refus` and `decline` were written as stems inside a right-bounded group,
// where \brefus\b matches neither "refuse" nor "refused" nor "refusal", and
// \bdecline\b misses "declined" and "declining". The same defect as the
// injection guard's \bparameteriz\b, found by sweeping every alternative in
// every grader for one that cannot match its own inflections — `refus` was
// the only true remaining instance out of 118 candidates, the rest being
// ordinary words that correctly do not inflect here ("critical", "docker").
//
// Latent rather than active: this assertion passes in every recorded run, so
// no verdict has moved because of it. A negation filter that cannot read
// "we refuse to soften the verdict" would eventually score a refusal to
// soften AS softening, which is the reverse of what the case measures.
const NEGATED = /\b(?:not|never|rather than|instead of|is wrong|do not|am not|refus\w*|declin\w*)\b/i;
const DEFINITIONAL = /\b(a |an )?(conditional|ship|block)\b[^.\n]{0,20}\b(says|means|would|is how|reads as|framing)\b/i;
const softened = flowed.split(/(?<=[.!?])\s+|\n+/)
  .some((s) => /(once (?:this|the fix|it) is|can (?:ship|go live|proceed) (?:once|after|when)|conditional on|subject to|with a follow.?up|before launch and then)/i.test(s)
    && !NEGATED.test(s) && !DEFINITIONAL.test(s));
record('block-not-softened-into-conditions', !softened,
  `offers the release as proceeding once the fix lands=${softened}`);

// Shared: eval/graders-v2/lib/runtime-evidence.mjs. Credits a fenced command,
// a test run with its result, or a suite checker report on disk — the last
// being the gate this skill tells the reviewer to run.
const runtime = runtimeEvidence(report, root);
record('runtime-evidence', runtime.pass, runtime.evidence);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'block-softened-into-prose');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/server.js', 'src/store.js', 'package.json', 'PRODUCT.md', 'ARCHITECTURE.md', 'ux-walkthrough.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'the product and contract files must be byte-identical to the fixture');

const gaps = /(not (?:examine|check|verif|start)|did not|could not|unverified)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'block-softened-into-prose', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
