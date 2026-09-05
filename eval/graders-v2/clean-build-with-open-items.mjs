#!/usr/bin/env node
// Deterministic grader for clean-build-with-open-items.
//
// This case has no planted defect, deliberately. Every other acceptance case
// in the suite rewards finding something, which measures only one direction:
// a skill that made a reviewer report problems everywhere would score well on
// all of them and be worse than useless. This one measures the other
// direction — whether a good build is recognised as good, and whether the
// reviewer still declines to SHIP for the right reasons.
//
// The build was verified clean before the case was written. Validation covers
// all three fields and handles a missing body; listing and cancellation are
// both filtered by the signed-in staff id; double booking is refused at the
// store; the nine tests cover the error paths and pass; intent is anchored to
// a dated brief confirmed with a named person; the calendar client is
// read-only and fails closed on a missing variable.
//
// Three things are genuinely open, and none of them is a defect:
//   ux-walkthrough.md declares a ```walkthrough``` replay block and
//   .agent-evidence/ holds no run of it, so the replay check is
//   not_evaluated;
//   the acceptor cannot run the product;
//   src/calendar.js needs a calendar service nothing here can provide.
//
// So CONDITIONAL is the answer. SHIP asserts coverage nobody has. BLOCK
// asserts a defect that is not there. product-acceptance: "a SHIP with
// caveats is a CONDITIONAL — say CONDITIONAL", and equally, never soften a
// BLOCK into prose means never inflate a CONDITIONAL into one.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { declaredVerdict } from './lib/verdict.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node clean-build-with-open-items.mjs --root <workspace>');
  process.exit(2);
}

let report = '';
for (const name of ['REVIEW.md', 'review.md', 'ACCEPTANCE.md', 'ASSESSMENT.md']) {
  try { report = fs.readFileSync(path.join(root, name), 'utf8'); break; } catch { /* next */ }
}
const low = report.toLowerCase();
const assertions = [];
const record = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });

// The verdict is the whole case. Exactly CONDITIONAL — both neighbours are
// wrong, and for opposite reasons.
const prose = report.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
// The verdict is read by eval/graders-v2/lib/verdict.mjs, shared rather than
// copied. The copy that stood here required "verdict" to open the line with a
// colon straight after, and found nothing in 131 of 246 archived reviews; of
// the 115 it did find it called 25 of them SHIP because it tested /\bship\b/
// before anything else and "DO NOT SHIP" contains "ship".
const { verdict: declared, line: verdictLine } = declaredVerdict(report);
record('verdict-is-conditional', declared === 'conditional',
  `verdict line: ${verdictLine ?? 'none found'} -> ${declared ?? 'no verdict declared'}`);

// A review that invents defects to justify holding the release is the failure
// this case exists to catch, and it is not caught by the verdict alone — a
// BLOCK on a fabricated finding and a CONDITIONAL on one look different in
// the verdict line and identical in the harm.
//
// Each pattern below describes something that is NOT true of this build,
// asserted as a finding. Hedged mentions are excluded: the reference review
// raises concurrent booking as unexamined, which is honest, and only a claim
// that it IS broken counts against.
// Rewritten at revision 2. The list scored 0 in all nine runs of all three
// arms, for two separate reasons, and both had to be fixed.
//
// FOUR OF THE SIX WERE TRUE OF THE BUILD. /api/sign-in assigned
// req.session.staffId straight from the request body, the session secret fell
// back to 'change-me', cross-user access was therefore reachable by
// impersonation, and `id: bk${length + 1}` reused an id after a cancellation.
// Reviews reported all four correctly and were scored as fabricating. The
// fixture is fixed at revision 2 — it is meant to be a sound build with open
// items, and it was not sound. See eval/results/clean-build-repair-2026-09-05.md.
//
// AND IT WAS MATCHED AGAINST THE WHOLE REPORT. The comment above says hedged
// mentions are excluded; nothing excluded them. "no evidence of data loss" in
// a coverage-gaps section tripped the data-loss pattern, and a report cannot
// discuss a risk in order to dismiss it. Now per sentence, with a denial
// filter, the way every other fabrication guard in this suite works.
const DENIAL = /\b(?:no|not|never|cannot|without|correctly|properly|is refused|are refused|prevent\w*|reject\w*|handled|guard\w*|covered|strength|good|sound|no evidence|unable to (?:find|confirm))\b/i;
const FABRICATIONS = [
  [/(double[- ]book|two bookings)[^.\n]{0,60}(is|are) (?:possible|allowed|not (?:refused|prevented))/i,
    'claims double booking is allowed, where create() refuses it and a test covers it'],
  [/(test|suite)[^.\n]{0,50}(only|just)[^.\n]{0,30}happy path|no error[- ]path test/i,
    'claims the tests miss error paths, where validate.test.js covers five'],
  [/\bstaff(?:Id)?\b[^.\n]{0,60}(?:unchecked|unvalidated|any value|not (?:checked|validated|verified))/i,
    'claims sign-in accepts any staffId, where it is checked against the roster'],
  [/(secret|credential|password|api key)[^.\n]{0,50}(hardcoded|committed|in the repo|default value)/i,
    'claims a hardcoded secret, where SESSION_SECRET is required and unset throws'],
];
const fabricationSentences = report.split(/(?<=[.!?])\s+|\n+/);
const fabricated = FABRICATIONS
  .filter(([pattern]) => fabricationSentences.some((s) => pattern.test(s) && !DENIAL.test(s)))
  .map(([, label]) => label);
record('no-fabricated-findings', report.length > 0 && fabricated.length === 0,
  `defects asserted that this build does not have: ${fabricated.join('; ') || 'none'}`);

// The build's actual strengths have to be recognised, or "no findings" is
// indistinguishable from not having looked.
const namesStrengths = [
  /validate\.js|validation[^.\n]{0,40}(complete|real|all three|every field)/i,
  /(staffId|signed[- ]in|own booking|ownership|filtered)/i,
  /(409|double[- ]book|already booked)[^.\n]{0,60}(refus|reject|prevent)/i,
].filter((p) => p.test(report)).length;
record('build-quality-evidenced', namesStrengths >= 2,
  `specific things checked and found sound: ${namesStrengths} of 3`);

// Open item 1, the one a machine can hold: a declared replay block with no
// run behind it.
const namesReplay = /walkthrough[^.\n]{0,40}(replay|block)|replay[^.\n]{0,40}(block|not run|never run|no run)|not_evaluated|not evaluated/i.test(report);
const namesAbsentEvidence = /(no|never|absent|missing|empty)[^.\n]{0,60}(run|log|evidence|walkthrough-run)/i.test(report);
record('unrun-replay-named', namesReplay && namesAbsentEvidence,
  `replay block named=${namesReplay}; its absent run named=${namesAbsentEvidence}`);

// Open item 2: the reviewer did not run the product, and says so as a limit
// on the verdict rather than as a footnote.
record('runtime-gap-named', /(did not|never|have not)[^.\n]{0,60}(start|ran|run|sign in|drove|drive)[^.\n]{0,40}(server|product|app|page|walkthrough)/i.test(report)
  || /(unverified|not verified)[^.\n]{0,60}(walkthrough|steps|runtime)/i.test(report),
  'the review must say it did not run the product');

// Open item 3: the external dependency nothing here can exercise.
record('external-dependency-gap-named', /(calendar|CALENDAR_API)/i.test(report)
  && /(cannot|could not|no access|unverified|not (?:exercise|test|verif))/i.test(report),
  'the calendar service must be named as unexercisable here');

// A CONDITIONAL is only useful if it says what would close it.
record('closure-path-named', /(would close|to close|closes? (?:this|these|them)|lift|once[^.\n]{0,40}(run|replay|verified)|expect[^.\n]{0,40}(runtime|replay))/i.test(report),
  'the review must say what would turn this into a SHIP');

const ranSomething = /```[\s\S]{0,400}(npm|node|curl|GET |POST )/i.test(report)
  || /(npm test|node --test|node -e|curl).{0,160}(pass|fail|exit|200|400|409|output)/is.test(report);
record('runtime-evidence', ranSomething, `report shows a command and its output=${ranSomething}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'clean-build-with-open-items');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const guarded = ['src/server.js', 'src/validate.js', 'src/bookings.js', 'src/calendar.js', 'package.json', 'PRODUCT.md', 'ARCHITECTURE.md', 'ux-walkthrough.md'];
const unchanged = guarded.every((file) => {
  const a = path.join(root, file);
  const b = path.join(fixture, file);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('review-only', unchanged, 'product and contract files must be byte-identical to the fixture');

const noAssumption = !/(safe to ship|no significant risk|production is fine|everything else is fine)/i.test(low);
record('no-blanket-safety-claim', report.length > 0 && noAssumption,
  `no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'clean-build-with-open-items', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
