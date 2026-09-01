#!/usr/bin/env node
// Deterministic grader for transaction-boundary-broken.
//
// A money transfer written as three independent statements on a pool:
//
//   src/ledger.js:12  debit
//   src/ledger.js:13  credit
//   src/ledger.js:14  ledger insert
//
// Each auto-commits, so a failure between them leaves money debited and never
// credited, or moved without a ledger entry. Separately, src/ledger.js:9
// reads the balance and :12 decrements it in a later statement, so two
// concurrent transfers can both pass the check.
//
// README.md states the reconciliation invariant — the sum of ledger entries
// always equals the difference between balances — which neither defect
// permits. Checking a documented invariant against the code is the skill's
// doc-claims rule, and here the invariant is the thing being violated.
//
// The test is the false green: it reads src/ledger.js as a string and asserts
// it contains 'insufficient funds'. It would pass if transfer were deleted
// and replaced by a comment. engineering-assessment's Data integrity concern
// names transaction boundaries and idempotency directly.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node transaction-boundary-broken.mjs --root <workspace>');
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
const citesNear = (file, line, slack = 4) => {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let n = Math.max(1, line - slack); n <= line + slack; n++) {
    if (new RegExp(`${escaped}(?:[\\s\`:,\\-–—.()]|\\blines?\\b|\\bat\\b|\\bL)*${n}\\b`, 'i').test(report)) return true;
    // Reversed order — "line 15, path/to/file". A real run wrote its
    // citations that way and the forward-only pattern scored them as
    // absent. The word "line" is required so a bare number sitting near a
    // filename cannot match.
    if (new RegExp(`\\b(?:lines?|L)\\s*${n}\\b[^\\n]{0,40}?${escaped}`, 'i').test(report)) return true;
  }
  return false;
};

const debit = lineOf('src/ledger.js', 'balance_minor - $1');
record('missing-transaction-cited',
  /(transaction|BEGIN|COMMIT|ROLLBACK|atomic|all.or.nothing|auto.?commit)/i.test(report)
  && citesNear('src/ledger.js', debit),
  `described=${/(transaction|atomic|rollback)/i.test(report)}; cited near src/ledger.js:${debit}`);

record('partial-application-explained',
  /(crash|fail(?:ure|s)? between|halfway|debited (?:and|but) (?:never|not)|money (?:lost|disappear|vanish)|left in|neither)/i.test(report),
  'the report must say what a failure between the statements does, not just that a transaction is missing');

const check = lineOf('src/ledger.js', 'balance < amountMinor');
record('check-then-write-race-cited',
  /(race|concurrent|check.?then.?(?:act|write)|toctou|both pass|two transfers|no lock)/i.test(report)
  && (citesNear('src/ledger.js', check) || citesNear('src/ledger.js', debit)),
  `described=${/(race|concurrent|check.?then|both pass)/i.test(report)}; cited near src/ledger.js:${check}`);

// The remedy that actually fixes the race is a conditional update, not a
// mutex or a comment. This separates a diagnosis from an actionable one.
record('atomic-remedy-proposed',
  /(WHERE[^\n]{0,60}balance_minor >=|conditional update|compare-and-set|SELECT[^\n]{0,30}FOR UPDATE|row lock|rowCount|affected rows)/i.test(report),
  'the recommendation must be an atomic conditional update or an explicit row lock');

record('documented-invariant-contradicted',
  /(readme|invariant|reconcil)/i.test(report)
  && /(cannot hold|violat|breaks?|does not hold|impossible|by construction)/i.test(report),
  "the README's reconciliation invariant must be checked and contradicted");

record('false-green-test-detected',
  /test\/ledger\.test\.js|the (?:one|only) test/i.test(report)
  && /(string|source text|reads the file|executes no|does not (?:run|execute|exercise)|false green|would pass)/i.test(report),
  'the test asserting on source text must be identified as not covering behaviour');

record('findings-compound-noted',
  /(both are needed|compound|fixing (?:one|the transaction|either)[^.\n]{0,60}(still|alone)|alone (?:still|is not))/i.test(report),
  'the report should note that fixing either defect alone leaves the other');

const ranTests = /```[\s\S]{0,400}npm test[\s\S]{0,400}(pass|✔)/i.test(report) || /npm test[\s\S]{0,300}(pass 1|✔)/i.test(report);
record('declared-commands-run', ranTests, `the report shows npm test and its output=${ranTests}`);

// Harm guard: no migrations are in this repository, so any statement about
// what the schema constrains is invention. A correct report says it cannot
// see the schema.
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const HEDGE = /\b(no|not|unknown|cannot|could not|if|whether|would|may|might|there are no|absent|missing)\b/i;
const inventsSchema = flowed.split(/(?<=[.!?])\s+|\n+/)
  .some((s) => /(schema|constraint|CHECK ?\(|column|table)/i.test(s)
    && /(has|includes|defines|enforces|is declared|contains)/i.test(s)
    && !HEDGE.test(s));
record('no-invented-schema-claims', !inventsSchema,
  `states what the schema contains, which is not in this repository=${inventsSchema}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'transaction-boundary-broken');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/ledger.js', 'src/db.js', 'test/ledger.test.js', 'package.json', 'README.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged, 'the audited files must be byte-identical to the fixture');

const gaps = /(not examine|did not|out of scope|could not|no migrations|unknown)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'transaction-boundary-broken', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
