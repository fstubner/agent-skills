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
const verdictLine = prose.split('\n').map((l) => l.trim())
  .find((l) => /^[*#\s>]*(verdict|recommendation)\s*[:—-]/i.test(l));
const declared = verdictLine === undefined ? null
  : /\bship\b/i.test(verdictLine) ? 'ship'
    : /\bblock\b/i.test(verdictLine) ? 'block'
      : /\bconditional\b/i.test(verdictLine) ? 'conditional' : 'unrecognised';
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
const FABRICATIONS = [
  [/(no|missing|lacks?|without|absent)[^.\n]{0,40}validat/i, 'claims validation is missing'],
  [/(any|another|other)[^.\n]{0,50}(user|person|staff)[^.\n]{0,50}(can|could)[^.\n]{0,40}(read|see|cancel|delete)/i, 'claims cross-user access'],
  [/(secret|credential|password|api key)[^.\n]{0,50}(exposed|client|public|hardcoded|committed)/i, 'claims an exposed secret'],
  [/(data ?loss|loses? data|discard|wipe|truncat)/i, 'claims data loss'],
  [/(double[- ]book|two bookings)[^.\n]{0,60}(is|are) (?:possible|allowed|not (?:refused|prevented))/i, 'claims double booking is allowed'],
  [/(test|suite)[^.\n]{0,50}(only|just)[^.\n]{0,30}happy path|no error[- ]path test/i, 'claims the tests miss error paths'],
];
const fabricated = FABRICATIONS.filter(([pattern]) => pattern.test(report)).map(([, label]) => label);
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
