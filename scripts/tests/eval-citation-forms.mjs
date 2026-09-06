// The citation matcher every grader shares, tested against the forms real
// runs actually write.
//
// It has been wrong four times. The first version required the filename
// before the number with only punctuation between, so "at line 15,
// .github/workflows/retention.yml" read as no citation. The second still
// rejected "**Location:** `src/server.js`, lines 25-27" — filename first, but
// separated by a comma and the word "lines". The third read only a range's
// first endpoint. The fourth, 2026-09-06: antigravity writes citations as
// markdown links with the line number in the URL fragment,
// "[server.js:L25-L28](file:///…/src/server.js#L25-L28)", and none of the
// twenty-three private copies of this matcher read a fragment at all. 33 of
// 99 antigravity reports, 258 citations, the skill arm losing every one.
//
// The cause is worth naming: the reference fixtures were written by one
// author in one citation style, so the pattern was tuned to a sample of one,
// and every other form a model writes scored as an absent citation. That is
// a systematic penalty on the arm that cites most. Between them the fixes
// have superseded well over a hundred runs.
//
// The matcher now lives in ONE place, eval/graders-v2/lib/citations.mjs, and
// this file tests that module directly rather than a copy of it. The second
// half checks that no grader has grown a private copy back.
//
// Add a form here before touching the pattern.
import fs from 'fs';
import path from 'path';
import { expect } from './harness.mjs';
import { citedSpansIn, RANGE_MAX, WHOLE_FILE_SHARE, WHOLE_FILE_MIN } from '../../eval/graders-v2/lib/citations.mjs';

const file = 'src/server.js';
const citesAt = (report, line, total = 0) => citedSpansIn(report, file, total).some(([a, b]) => a <= line && line <= b);
const near = (report, line, slack = 4) => citedSpansIn(report, file).some(([a, b]) => a - slack <= line && line <= b + slack);

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

// Ranges, the fifth form. A range is read as the span it covers, and a span
// covering the whole file is a reference to the file rather than a citation
// of anything in it. Proportional, not a line count: a flat cap of 8 rejected
// 26 real citations of a function span in a long file. WHOLE_FILE_MIN is the
// floor below which citing every line is the most precise citation there is.
const ranges = [
  ['src/server.js:24-28', 0, true],
  ['reported at lines 24-28 in src/server.js', 0, true],
  ['`src/server.js` lines 22–26 look wrong', 0, true],
  ['src/server.js:20-31', 200, true],
  ['src/server.js:30-34', 0, false],
  ['src/server.js:1-4000 reviewed in full', 0, false],
  ['src/server.js:1-30', 32, false],
  ['src/server.js:24-28', 4, true],
];

// The sixth form: the line number in a link's URL fragment. The visible text
// carries only the basename, so it is the fragment that has to be read.
const fragments = [
  ['[server.js:L25-L28](file:///C:/tmp/agent-skills-eval-o2i8tp/workspace/src/server.js#L25-L28)', true],
  ['[server.js:L26](file:///C:/tmp/x/workspace/src/server.js#L26)', true],
  ['([server.js](file:///C:/tmp/x/workspace/src/server.js#L24-L27)) does not verify ownership', true],
  ['[server.js](file:///C:/tmp/x/workspace/src/server.js)', false],           // no fragment, no line
  ['[server.js:L30-L33](file:///C:/tmp/x/workspace/src/server.js#L30-L33)', false], // range not containing 26
  ['[store.js:L26](file:///C:/tmp/x/workspace/src/store.js#L26)', false],      // other file
];

for (const [sample, want] of samples) {
  const label = want ? 'recognised' : 'correctly ignored';
  expect(`citation ${label}: ${sample.slice(0, 46)}`, near(sample, 26) === want, sample);
}
for (const [sample, total, want] of ranges) {
  const label = want ? 'recognised' : 'correctly ignored';
  expect(`range ${label}: ${sample.slice(0, 46)}`, citesAt(sample, 26, total) === want, sample);
}
for (const [sample, want] of fragments) {
  const label = want ? 'recognised' : 'correctly ignored';
  expect(`fragment ${label}: ${sample.slice(0, 56)}`, citesAt(sample, 26) === want, sample);
}
expect('citation constants are the ones the graders were measured with',
  RANGE_MAX === 40 && WHOLE_FILE_SHARE === 0.8 && WHOLE_FILE_MIN === 20, `${RANGE_MAX} ${WHOLE_FILE_SHARE} ${WHOLE_FILE_MIN}`);

// One implementation. A grader that declares its own citedSpans has drifted
// from the shared one by construction, whatever its body says; and a grader
// that declares a cites* wrapper without importing the shared matcher is
// building on something private. Stated as a set rather than found by a
// pattern, for the reason recorded in this file's history: a selector that
// happened to match only the already-fixed copies once let four stale ones
// through, green.
const root = path.resolve(import.meta.dirname, '..', '..');
const graderDir = path.join(root, 'eval', 'graders-v2');
const NOT_CITATION_HELPERS = new Set([
  'stale-replay-evidence.mjs', // citesStep matches an empty-state phrase, no file or line
]);
const all = fs.readdirSync(graderDir).filter((f) => f.endsWith('.mjs'));
const privateCopies = all.filter((f) => /const citedSpans\s*=\s*\(/.test(fs.readFileSync(path.join(graderDir, f), 'utf8')));
expect('no grader carries a private copy of the citation matcher', privateCopies.length === 0, `private copies: ${privateCopies.join(', ')}`);
const declaring = all.filter((f) => /\bcites\w*\s*=/.test(fs.readFileSync(path.join(graderDir, f), 'utf8')) && !NOT_CITATION_HELPERS.has(f));
expect('the citation-grader set is not empty', declaring.length > 0, `declaring=${declaring.length}`);
const notImporting = declaring.filter((f) => !/from '\.\/lib\/citations\.mjs'/.test(fs.readFileSync(path.join(graderDir, f), 'utf8')));
expect('every grader declaring a citation helper builds it on the shared matcher',
  notImporting.length === 0, `not importing: ${notImporting.join(', ')}`);
