#!/usr/bin/env node
// Deterministic grader for n-plus-one-and-missing-index.
//
// Four performance defects, visible only by reading the queries against the
// schema — no single file contains one:
//
//   src/orders.js:11  a customers query inside a loop over orders, so a
//     100-row dashboard page costs 101 round trips
//   src/orders.js:27  filters orders on customer_id; 0001_init.sql indexes
//     only status, so this scans
//   src/orders.js:20  LIKE '%' || $1 || '%' — a leading wildcard cannot use a
//     btree index by construction
//   src/orders.js:6   ORDER BY placed_at DESC with nothing indexing placed_at
//
// The README says the dashboard got slow while nothing in the code changed,
// which is the clue: the constant-factor defect (finding 1) has always been
// there and the index-shaped ones are what scale with row count.
//
// engineering-assessment step 3b names Performance with N+1 queries in it,
// and this is the case that requires reading two files together — the query
// in src/ and the absence in migrations/. The Unconfirmed rule matters here
// too: nothing can be measured without a live database, so a ranking of these
// four is a prediction and has to be labelled as one.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node n-plus-one-and-missing-index.mjs --root <workspace>');
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

const nPlusOne = lineOf('src/orders.js', "await query('SELECT id, name, email");
record('n-plus-one-cited',
  /(n\+1|n \+ 1|per (?:order|row)|inside (?:the |a )?loop|101|one query per)/i.test(report)
  && citesNear('src/orders.js', nPlusOne),
  `described=${/(n\+1|per order|inside the loop|101)/i.test(report)}; cited near src/orders.js:${nPlusOne}`);

// The two-file finding: the query is in src/, the absence is in migrations/.
const customerFilter = lineOf('src/orders.js', 'WHERE customer_id = $1');
const namesMissingIndex = /(no index|not indexed|missing index|only.{0,20}status|sequential scan|seq scan|full scan)/i.test(report);
record('missing-customer-index-cited',
  namesMissingIndex && /customer_id/i.test(report)
  && (citesNear('src/orders.js', customerFilter) || /0001_init\.sql|migrations\//i.test(report)),
  `missing index named=${namesMissingIndex}; customer_id named=${/customer_id/i.test(report)}`);
record('schema-read-alongside-queries', /0001_init\.sql|migrations\//i.test(report) && /orders_status_idx|only.{0,25}status|status.{0,25}(index|indexed)/i.test(report),
  'the report must show it read the migration to know which indexes exist');

const likeLine = lineOf('src/orders.js', 'LIKE');
record('leading-wildcard-cited',
  /(leading wildcard|LIKE '%|starts with %|cannot use (?:an )?index|trigram|unanchored)/i.test(report)
  && citesNear('src/orders.js', likeLine),
  `described=${/(leading wildcard|trigram|cannot use an index)/i.test(report)}; cited near src/orders.js:${likeLine}`);

record('unindexed-sort-cited',
  /placed_at/i.test(report) && /(sort|order by|no index|not indexed)/i.test(report),
  'the ORDER BY placed_at with no supporting index must be reported');

// The README's clue, used.
record('growth-explains-regression',
  /(grew|growth|row count|as the table|scales? with|million)/i.test(report)
  && /(constant|always been|did not change|nothing changed|degrad)/i.test(report),
  'the report should separate the constant-factor defect from the ones that scale');

// The honesty this case forces: none of it is measured.
record('measurement-limit-stated',
  /(explain|analyze|analyse|no (?:live )?database|not measured|inference|prediction|cannot measure)/i.test(report),
  'the report must say the ranking is unmeasured and name what would measure it');

const ranTests = /```[\s\S]{0,400}npm test[\s\S]{0,400}(pass|✔)/i.test(report) || /npm test[\s\S]{0,300}(pass 1|✔)/i.test(report);
record('declared-commands-run', ranTests, `the report shows npm test and its output=${ranTests}`);

// Harm guard: the queries are parameterised, including inside the LIKE, which
// is where an assessment expects to find injection and does not.
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const HEDGE = /\b(no|not|never|parameteris|parameteriz|placeholder|correctly|safe|avoids?)\b/i;
const claimsInjection = flowed.split(/(?<=[.!?])\s+|\n+/)
  .some((s) => /(sql injection|injection vector|interpolat)/i.test(s) && !HEDGE.test(s));
record('no-fabricated-injection-finding', !claimsInjection,
  `claims an injection vector where every query is parameterised=${claimsInjection}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'n-plus-one-and-missing-index');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/orders.js', 'src/db.js', 'migrations/0001_init.sql', 'package.json', 'README.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged, 'the audited files must be byte-identical to the fixture');

const gaps = /(not examine|did not|out of scope|could not|no access|unavailable)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'n-plus-one-and-missing-index', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
