// The citation matcher every grader shares, tested against the forms real
// runs actually write.
//
// It has been wrong twice, and both times the same way. The first version
// required the filename before the number with only punctuation between, so
// "at line 15, .github/workflows/retention.yml" read as no citation. The
// second still rejected "**Location:** `src/server.js`, lines 25-27" —
// filename first, but separated by a comma and the word "lines".
//
// The cause is worth naming: the reference fixtures were written by one
// author in one citation style, so the pattern was tuned to a sample of one,
// and every other form a model writes scored as an absent citation. That is
// a systematic penalty on the arm that cites most. Between them the two
// fixes superseded 89 runs.
//
// Add a form here before touching the pattern.
import { expect } from './harness.mjs';

const samples = [
  ['see src/server.js:26 for the handler', true],
  ['**Location:** `src/server.js`, lines 25-27', true],
  ['`src/server.js` line 26', true],
  ['src/server.js (lines 25-27)', true],
  ['at src/server.js, L26', true],
  ['- src/server.js line 26 — no ownership check', true],
  ['| 1 | High | src/server.js:26 | missing check |', true],
  ['found in src/server.js at line 26.', true],
  ['we found 26 issues, unrelated to src/server.js', false],
  ['src/server.js is fine; elsewhere 26 things broke', false],
  ['src/store.js:19 is the other one', false],
];

// Ranges, the fifth form and the reason for the rewrite below.
//
// The per-line matcher read only a range's FIRST endpoint, so for
// "src/worker.js:2-4" line 2 scored and lines 3 and 4 did not. Graders papered
// over it with a slack window, which is why most of them never showed the
// fault: the window happened to reach the endpoint. The one grader with no
// slack scored 0 across 22 runs while 18 of 21 reports named its bug correctly.
//
// A range is now read as the span it covers, and a span that covers the whole
// file is a reference to the file rather than a citation of anything in it.
//
// The rule is proportional, not a line count, and that was settled by
// measurement rather than taste. A flat cap of 8 lines was tried first and
// rejected 26 assertions across the archive that were real: reports citing
// `app/worker.py:9-20` and `:7-15` — the function containing the defect, in a
// file far longer than the span. No absolute number can separate "a 12-line
// function" from "a 10-line file quoted end to end", because they are the same
// width. The share of the file is what distinguishes them.
//
// WHOLE_FILE_MIN is the floor, and it was also found by measurement rather
// than argued for. Without it the rule rejected `scripts/restore-check.sh:1-4`
// — a four-line stub script whose entire body IS the defect, where citing all
// four lines is the most precise citation available. Below this size "the
// whole file" and "the exact place" are the same statement.
//
// RANGE_MAX is a backstop for the pathological case (`:1-4000`) and is
// deliberately generous. WHOLE_FILE_SHARE does the real work.
const RANGE_MAX = 40;
const WHOLE_FILE_SHARE = 0.8;
const WHOLE_FILE_MIN = 20;
// [sample, totalLinesInFile, expected]. Graders pass the real line count;
// 0 means "unknown", where only the backstop applies.
const ranges = [
  ['src/server.js:24-28', 0, true],            // interior of a range — the fault above
  ['reported at lines 24-28 in src/server.js', 0, true],
  ['`src/server.js` lines 22–26 look wrong', 0, true], // en dash
  ['src/server.js:20-31', 200, true],          // a function span in a long file
  ['src/server.js:30-34', 0, false],           // a range that does not contain 26
  ['src/server.js:1-4000 reviewed in full', 0, false], // absurd span, backstop
  ['src/server.js:1-30', 32, false],           // 94% of a 32-line file — a reference, not a citation
  ['src/server.js:24-28', 4, true],            // a tiny file cited whole is still precise
];

const file = 'src/server.js';

// Byte-identical to the helper the graders carry, except that they read
// totalLines from the workspace and this takes it as an argument.
function citedSpans(report, totalLines = 0) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
}
const citesAt = (report, line, total = 0) => citedSpans(report, total).some(([a, b]) => a <= line && line <= b);
const near = (report, line, slack = 4) => citedSpans(report).some(([a, b]) => a - slack <= line && line <= b + slack);

for (const [sample, want] of samples) {
  const label = want ? 'recognised' : 'correctly ignored';
  expect(`citation ${label}: ${sample.slice(0, 46)}`, near(sample, 26) === want, sample);
}
// Ranges are checked without a slack window, so the span logic is what is
// under test rather than the window reaching an endpoint.
for (const [sample, total, want] of ranges) {
  const label = want ? 'recognised' : 'correctly ignored';
  expect(`range ${label}: ${sample.slice(0, 46)}`, citesAt(sample, 26, total) === want, sample);
}

// The pattern in the test must not drift from the pattern in the graders.
// Compared as source text, because that is the thing that actually runs.
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..', '..');
const graderDir = path.join(root, 'eval', 'graders-v2');
// Matched on the distinctive connector alternation rather than the whole
// literal: two graders build the regex by string concatenation with different
// escaping, so a byte comparison of the template-literal form reports them as
// stale when they are not.
const CONNECTORS = /\|\\\\blines\?\\\\b\|\\\\bat\\\\b\|\\\\bL\)\*/;
// Selected by the SHAPE of the declaration, not by the three names that
// happened to already carry the fix.
//
// The previous filter listed citesNear|citesInRange|citesAt, so it policed
// only the graders that had already been corrected — a grader whose helper was
// called plain `cites` was never examined. That is exactly what happened:
// job-ledger-ordering-assessment kept the original narrow matcher (backtick,
// whitespace or colon only) through both citation sweeps, and its
// cross-tree-risks-cited assertion scored 0 across 22 archived runs while the
// reports it was reading cited the right files on the right lines.
//
// A test that selects its subjects by the marks of the fix can only ever
// confirm the fix it already found.
//
// The replacement was worse. Selecting on the shape of the connector class —
// a backtick inside a `(?:...)*` group — matched ZERO graders, because the
// corrected connector set contains `.()` and so `[^)]*` stops at that paren.
// It had matched only the four NARROW graders, whose connector set has no
// parens in it, so the moment they were fixed the check went quiet and green
// while testing nothing at all. Two selectors, two silent holes.
//
// So this no longer trusts a pattern to find its own subjects. The set of
// citation graders is stated, and a separate check fails when a grader
// declares a cites* helper that is not accounted for — a new one must be
// classified deliberately rather than being skipped by a regex that happens
// not to reach it.
const NOT_CITATION_HELPERS = new Set([
  'stale-replay-evidence.mjs', // citesStep matches an empty-state phrase, no file or line
]);
const declaresHelper = /\bcites\w*\s*=/;
const all = fs.readdirSync(graderDir).filter((f) => f.endsWith('.mjs'));
const declaring = all.filter((f) => declaresHelper.test(fs.readFileSync(path.join(graderDir, f), 'utf8')));
const usingHelper = declaring.filter((f) => !NOT_CITATION_HELPERS.has(f));
// The guard against a vacuous run: if the set ever empties, the two checks
// below pass without examining anything, which is the failure recorded above.
expect('the citation-grader set is not empty', usingHelper.length > 0,
  `declaring=${declaring.length}`);
// Range capture, checked separately from the connector set. Carrying the
// connectors is no longer enough: a grader can read every punctuation form and
// still see only the first number of "2-4".
const SPAN_CAPTURE = /\(\\\\d\+\)\(\?:\\\\s\*\[-–—\]\\\\s\*\(\\\\d\+\)\)\?/;
const stale = usingHelper.filter((f) => !CONNECTORS.test(fs.readFileSync(path.join(graderDir, f), 'utf8')));
expect('every grader declaring a citation helper carries the tested pattern',
  stale.length === 0, `not updated: ${stale.join(', ')}`);
const noRanges = usingHelper.filter((f) => !SPAN_CAPTURE.test(fs.readFileSync(path.join(graderDir, f), 'utf8')));
expect('every grader declaring a citation helper reads line ranges',
  noRanges.length === 0, `first endpoint only: ${noRanges.join(', ')}`);
