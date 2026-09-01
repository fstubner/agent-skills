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

const file = 'src/server.js';
const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Byte-identical to the helper the graders carry.
function cites(report, n) {
  const fwd = new RegExp(`${escaped}(?:[\\s\`:,\\-–—.()]|\\blines?\\b|\\bat\\b|\\bL)*${n}\\b`, 'i');
  const rev = new RegExp(`\\b(?:lines?|L)\\s*${n}\\b[^\\n]{0,40}?${escaped}`, 'i');
  return fwd.test(report) || rev.test(report);
}

// Graders scan a window around the target line, so a range citation only has
// to land one endpoint inside it.
const near = (report, line, slack = 4) => {
  for (let n = Math.max(1, line - slack); n <= line + slack; n++) if (cites(report, n)) return true;
  return false;
};

for (const [sample, want] of samples) {
  const label = want ? 'recognised' : 'correctly ignored';
  expect(`citation ${label}: ${sample.slice(0, 46)}`, near(sample, 26) === want, sample);
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
// Selecting on the identifier name was also wrong, in the other direction:
// stale-replay-evidence names a plain keyword test `citesStep`, and it has no
// file or line in it at all. What every real citation matcher has instead is a
// repeated connector class sitting between the path and the number — the
// backtick inside a `(?:...)*` group is present in the narrow form and the
// corrected one alike, and absent from anything that is not joining a path to
// a line.
const CONNECTOR_CLASS = /\(\?:[^)\n]*`[^)\n]*\)\*/;
const usingHelper = fs.readdirSync(graderDir)
  .filter((f) => f.endsWith('.mjs'))
  .filter((f) => CONNECTOR_CLASS.test(fs.readFileSync(path.join(graderDir, f), 'utf8')));
const stale = usingHelper.filter((f) => !CONNECTORS.test(fs.readFileSync(path.join(graderDir, f), 'utf8')));
expect('every grader declaring a citation helper carries the tested pattern',
  stale.length === 0, `not updated: ${stale.join(', ')}`);
