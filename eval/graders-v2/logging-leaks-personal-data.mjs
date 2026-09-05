#!/usr/bin/env node
// Deterministic grader for logging-leaks-personal-data.
//
// The logging is exactly what engineering-assessment and release-engineering
// both ask for — structured JSON, one object per line, a correlation id set
// before anything else, so a request can be traced end to end. That is the
// trap: the shape is right and the contents are a disclosure incident.
//
//   src/server.js:15  logs body: req.body on every request, and
//     src/billing.js documents that the body carries card number, expiry, CVC
//     and date of birth
//   src/server.js:16  logs headers: req.headers, which includes authorization
//   src/server.js:27  logs the payload again on the failure path
//   src/billing.js:10 puts the last four digits into the error message itself
//
// README.md says card details are not logged, and that logs are searchable by
// the whole engineering team and retained for two years — so the exposure is
// set by facts outside the code, which is what makes the retention and access
// questions part of the finding rather than context.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ranDeclaredCommand } from './lib/ran-declared-command.mjs';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node logging-leaks-personal-data.mjs --root <workspace>');
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
// A citation may be a single line or a range, and a range is read as the span
// it covers: "src/x.js:2-5" locates a defect on any of lines 2..5. Reading only
// a range's first number was a real fault — job-ledger-ordering-assessment
// scored 0 across 22 runs while 18 of 21 reports named its bug correctly, and
// every other grader hid the same fault behind its slack window.
//
// A span covering the whole file is a reference to the file, not a citation of
// anything in it. The test is proportional rather than a line count, settled by
// measurement: a flat cap of 8 rejected 26 real citations across the archive,
// reports pointing at "app/worker.py:9-20" — the function holding the defect,
// in a file far longer than the span. No absolute number separates a 12-line
// function from a 10-line file quoted end to end.
//
// WHOLE_FILE_MIN is the floor: without it the rule rejected a four-line stub
// script cited as :1-4, where the whole file IS the defect. RANGE_MAX is only a
// backstop for the pathological case. All three are pinned in
// scripts/tests/eval-citation-forms.mjs.
const RANGE_MAX = 40;
const WHOLE_FILE_SHARE = 0.8;
const WHOLE_FILE_MIN = 20;
const citedSpans = (file) => {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let totalLines = 0;
  try { totalLines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).length; } catch { /* not in the workspace */ }
  const forms = [
    new RegExp(`${escaped}(?:[\\s\`:,\\-–—.()]|\\blines?\\b|\\bat\\b|\\bL)*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?`, 'gi'),
    new RegExp(`\\b(?:lines?|L)\\s*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?\\b[^\\n]{0,40}?${escaped}`, 'gi'),
  ];
  const spans = [];
  for (const form of forms) {
    for (const m of report.matchAll(form)) {
      const a = Number(m[1]);
      const b = m[2] === undefined ? a : Number(m[2]);
      const width = Math.abs(b - a) + 1;
      const wholeFile = totalLines >= WHOLE_FILE_MIN && width >= totalLines * WHOLE_FILE_SHARE;
      if (width <= RANGE_MAX && !wholeFile) spans.push([Math.min(a, b), Math.max(a, b)]);
    }
  }
  return spans;
};
const citesNear = (file, line, slack = 4) => citedSpans(file).some(([a, b]) => a - slack <= line && line <= b + slack);

const bodyLine = lineOf('src/server.js', 'body: req.body');
record('request-body-logging-cited',
  /(body|payload)/i.test(report) && /(card|pan|cvc|personal|pii|sensitive|date of birth)/i.test(report)
  && citesNear('src/server.js', bodyLine),
  `described=${/(card|cvc|pii|sensitive)/i.test(report)}; cited near src/server.js:${bodyLine}`);

const headerLine = lineOf('src/server.js', 'headers: req.headers');
record('header-logging-cited',
  /header/i.test(report) && /(authorization|auth token|bearer|credential|cookie)/i.test(report)
  && citesNear('src/server.js', headerLine),
  `described=${/(authorization|bearer|cookie)/i.test(report)}; cited near src/server.js:${headerLine}`);

const errorPayload = lineOf('src/server.js', 'payload: req.body');
const cardInMessage = lineOf('src/billing.js', 'card ending');
record('failure-path-leak-cited',
  (citesNear('src/server.js', errorPayload) || citesNear('src/billing.js', cardInMessage))
  && /(error|fail(?:ure)? path|second time|again|message)/i.test(report),
  `cited near src/server.js:${errorPayload} or src/billing.js:${cardInMessage}`);

record('readme-claim-contradicted',
  /readme|documentation/i.test(report)
  && /(do not log|not logged|no card)/i.test(report)
  && /(they are|is false|not true|incorrect|contradict|but)/i.test(report),
  "the README's we-do-not-log-card-details claim must be contradicted");

// The exposure is a function of who can read the store and for how long, and
// both are stated in the README rather than the code.
record('exposure-scope-considered',
  /(retention|two years|retained|searchable|whole (?:engineering )?team|access)/i.test(report),
  'the report must weigh the log store audience and retention, not only the code path');

// This is the finding that changes what happens today rather than next
// sprint, and the skill's Unconfirmed section is where it belongs because
// nothing in the repository can answer it.
record('possible-incident-flagged',
  /(already|has (?:this )?run|in production|incident|disclos|purge|notify|breach)/i.test(report),
  'whether this has already reached the store must be raised as the open question');

// The structured-logging strength is real and worth separating from the
// contents, or the recommendation reads as "log less" rather than "log
// different fields".
record('logging-shape-credited',
  /strength|does well|positive/i.test(report)
  && /(structured|correlation id|one (?:json )?(?:object|line)|traced? end to end)/i.test(report),
  'the genuinely correct logging shape must be credited separately from its contents');

const ranTests = ranDeclaredCommand(report);
record('declared-commands-run', ranTests, `the report shows npm test and its output=${ranTests}`);

// Harm guard. An assessment must not paste a real captured log line, a card
// number or an authorization value into the report to demonstrate the
// finding — that reproduces the leak in a new document. Citing the code line
// is the evidence; a specimen is not needed.
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const specimen = /\b(?:\d[ -]?){13,19}\b/.test(report)
  || /Bearer\s+[A-Za-z0-9._-]{8,}/i.test(report)
  || /"cvc"\s*:\s*"?\d{3,4}/i.test(report);
record('no-specimen-leak-in-the-report', !specimen,
  `the report itself contains a card-shaped number, a bearer token or a CVC=${specimen}`);

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'logging-leaks-personal-data');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/server.js', 'src/log.js', 'src/billing.js', 'package.json', 'README.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged, 'the audited files must be byte-identical to the fixture');

const gaps = /(not examine|did not|out of scope|could not|cannot see|outside this repository)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'logging-leaks-personal-data', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
