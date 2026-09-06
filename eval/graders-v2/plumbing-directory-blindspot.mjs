#!/usr/bin/env node
// Deterministic grader for plumbing-directory-blindspot.
//
// The application code is the healthiest part of this repository: input
// validated at the boundary, every query parameterised, one passing test.
// Every serious defect is in a directory an assessment tends not to open.
//
//   .github/workflows/retention.yml:16  runs psql against
//     PRODUCTION_DATABASE_URL on a nightly cron
//   migrations/0004_orders_retention.sql:3  unbounded DELETE FROM orders
//   migrations/0004_orders_retention.sql:5  DROP COLUMN, in a file the cron
//     re-runs every night — one-off DDL on a recurring schedule
//   scripts/restore-check.sh:4  the backup restore check is `exit 0`, stubbed
//     out since May, so nothing would notice the data loss above
//
// engineering-assessment step 3a: enumerate before reading, and directories
// that look like plumbing are in scope precisely because nobody reads them.
// The skill records this rule's origin as an eval where a well-structured
// assessment never opened migrations/. This case is that failure, planted.
//
// The three sites are separate assertions. A single pooled citation check
// could not tell an assessment that opened .github/ from one that opened all
// three, which is the lesson recorded in engineering-assessment-retry-storm.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ranDeclaredCommand } from './lib/ran-declared-command.mjs';
import { citationMatchers } from './lib/citations.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node plumbing-directory-blindspot.mjs --root <workspace>');
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

const CITATIONS = [
  ['retention-workflow-cited', '.github/workflows/retention.yml', lineOf('.github/workflows/retention.yml', 'psql'),
    /(nightly|cron|schedule|every night|production database|PRODUCTION_DATABASE_URL)/i],
  ['unbounded-delete-cited', 'migrations/0004_orders_retention.sql', lineOf('migrations/0004_orders_retention.sql', 'DELETE FROM orders'),
    /(delete|purge|remov|irreversib|data loss|unbounded)/i],
  ['recurring-ddl-cited', 'migrations/0004_orders_retention.sql', lineOf('migrations/0004_orders_retention.sql', 'DROP COLUMN'),
    /(drop column|ddl|one-?off|re-?run|applied (?:again|repeatedly|nightly))/i],
  ['stubbed-restore-check-cited', 'scripts/restore-check.sh', lineOf('scripts/restore-check.sh', 'exit 0'),
    /(exit 0|stub|disabled|always (?:passes|succeeds|reports)|cannot fail|no-?op)/i],
];
for (const [id, file, line, described] of CITATIONS) {
  record(id, described.test(report) && citesNear(file, line),
    `described=${described.test(report)}; cited near ${file}:${line}`);
}

// The point of the case: the plumbing was opened at all. An assessment that
// only ever names src/ has not enumerated.
const dirsNamed = ['.github', 'migrations', 'scripts'].filter((d) => new RegExp(d.replace('.', '\\.'), 'i').test(report));
record('plumbing-directories-enumerated', dirsNamed.length === 3,
  `plumbing directories named in the report: ${dirsNamed.join(', ') || 'none'}`);

// Step 0: the declared commands were run and their output pasted.
const ranTests = ranDeclaredCommand(report);
record('declared-commands-run', ranTests,
  `the report shows npm test and its output=${ranTests}`);

// The suite is one test over a formatting helper; calling it coverage is the
// false green this skill exists to catch.
record('thin-test-coverage-noted',
  /(one test|single test|only.{0,25}(test|format)|does not (?:cover|touch|exercise)|untested)/i.test(report)
  && /(orders\.js|app\.js|format)/i.test(report),
  'the report must note the suite covers a formatting helper and nothing else');

const severity = /\b(critical|high|medium|low|info)\b/i.test(report);
const unconfirmed = /(unconfirmed|requires investigation|suspected|could not confirm|cannot (?:see|tell))/i.test(report);
record('ranked-actionable-findings', severity && unconfirmed,
  `severity vocabulary=${severity}; unconfirmed section=${unconfirmed}`);

// The skill requires at least two strengths where the codebase has merit, and
// here it genuinely does — this is the half of the rubric that a
// findings-only assessment skips.
const strengths = /strength|does well|positive/i.test(report)
  && (/(validat|boundary)/i.test(report) && /(parameteris|parameteriz|\$1|placeholder)/i.test(report));
record('strengths-evidenced', strengths,
  'at least two evidenced strengths, which this codebase genuinely has');

// Base-capability guards. The assessment must not edit the thing it audits,
// and must not invent defects in the part that is sound.
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'plumbing-directory-blindspot');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/app.js', 'src/orders.js', 'src/format.js', 'migrations/0004_orders_retention.sql',
  '.github/workflows/retention.yml', 'scripts/restore-check.sh', 'package.json'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged, 'the audited files must be byte-identical to the fixture');

// Tested per sentence with denials skipped, and both patterns narrowed after
// a real run failed this guard twice on things it had right. It wrote
// "eliminating SQL injection risk — a security best practice correctly
// applied", which is a strength, and "missing input validation for customer
// ID type", which is accurate: app.js checks that customerId is present and
// never checks its type. A guard against invented defects must not fire on a
// true specific finding or on praise.
// `eliminat` and `avoid` were written as stems but sat inside a right-bounded
// group, where \beliminat\b cannot match "eliminating" — the very word the
// comment above says this line was changed to handle. The example survived
// only because "correctly" happened to appear in the same sentence.
const DENIAL = /\b(?:no|not|none|never|cannot|without|correctly|properly|strength|best practice|good|eliminat\w*|avoid\w*|prevent\w*|protect\w*)\b/i;
const FABRICATIONS = [
  [/(vulnerable to|risk of|susceptible to|allows?)[^.\n]{0,30}(sql )?injection/i,
    'claims an injection vector where every query is parameterised'],
  // REMOVED, 2026-09-04: a clause matching "no/missing/without validation"
  // unless the word "for" followed within 20 characters. It was meant to catch
  // a report claiming the app validates nothing, where both POST fields are
  // checked. It never caught one. Across 42 archived bundles every hit was a
  // true finding scoped some other way:
  //
  //   "### Missing Input Validation - Negative Totals"      (heading, dash)
  //   "GET /orders endpoint lacks input validation"          (endpoint first)
  //   "Combined with missing input validation (#1), ..."     (back-reference)
  //   "Missing input validation (Finding #3) allows ..."     (back-reference)
  //
  // Widening the lookahead to on/of/in/at fixed none of them, because the
  // scope is not always carried by a preposition. Four accurate reports and
  // zero fabrications is a guard measuring the wrong thing, and the same
  // judgement was applied to a draft index-denial guard in
  // n-plus-one-and-missing-index the same day: abandoned, not tuned.
];
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const sentences = flowed.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim());
const fabricated = FABRICATIONS
  .filter(([p]) => sentences.some((s) => p.test(s) && !DENIAL.test(s)))
  .map(([, l]) => l);
record('no-fabricated-findings', report.length > 0 && fabricated.length === 0,
  `defects asserted that the application code does not have: ${fabricated.join('; ') || 'none'}`);

const gaps = /(not examine|did not|out of scope|could not|no access|unavailable)/i.test(report);
const namesAbsent = /(production database|backup|run history|secrets|npm audit|runtime|dependencies are not installed)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps=${gaps}; specific absences named=${namesAbsent}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'plumbing-directory-blindspot', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
