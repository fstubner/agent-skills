// Where does a report say a finding lives?
//
// One implementation, because twenty-three copies is how this matcher came to
// need four separate repairs. The first fix corrected 18 graders and left 4
// on the old pattern; the drift test written to prevent that selected graders
// by the helper name only the already-fixed copies used, so it could only
// confirm the fix it had already found. The second fix reached the four. The
// third made ranges readable. The fourth — the reason this file exists — is
// the sixth citation form, below, and it would have meant editing twenty-three
// files again, one of which had already quietly diverged from the others.
//
// The lesson runs-superseded/README.md records twice over: a matcher tuned on
// hand-written reference fixtures is tuned on a sample of one author's style,
// and every form a real model writes that the author did not is scored as no
// citation at all. That is a systematic penalty on the arm that cites most,
// which is the skill arm. Add a form here, add a specimen to
// scripts/tests/eval-citation-forms.mjs, and every grader has it.
//
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
// backstop for the pathological case.
import fs from 'node:fs';
import path from 'node:path';

export const RANGE_MAX = 40;
export const WHOLE_FILE_SHARE = 0.8;
export const WHOLE_FILE_MIN = 20;

const escapeForRegex = (file) => file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The forms real reports write, in the order they were learned:
//   1. path, connector, number:      src/x.js:26   `src/x.js`, lines 25-27   src/x.js at L26
//   2. number, then path:            line 15, src/x.js   L26 of src/x.js
//   3. (form 1, with a range)        src/x.js:2-5
// The sixth, learned 2026-09-06 from the antigravity cohort and read by none
// of the twenty-three copies: the line number in a link's URL fragment —
//   [x.js:L25-L28](file:///…/src/x.js#L25-L28)
// 0 of 336 claude-code reports wrote it; 33 of 99 antigravity reports did,
// 258 citations, and the skill arm — the arm citing the graded lines — lost
// every one of them.
export function citationForms(file) {
  const escaped = escapeForRegex(file);
  return [
    new RegExp(`${escaped}(?:[\\s\`:,\\-–—.()]|\\blines?\\b|\\bat\\b|\\bL)*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?`, 'gi'),
    new RegExp(`\\b(?:lines?|L)\\s*(\\d+)(?:\\s*[-–—]\\s*(\\d+))?\\b[^\\n]{0,40}?${escaped}`, 'gi'),
    new RegExp(`${escaped}#L?(\\d+)(?:\\s*[-–—]\\s*L?(\\d+))?\\b`, 'gi'),
  ];
}

// Every [from, to] span the report cites for `file`, with whole-file
// references and absurd ranges dropped. `totalLines` is the file's length in
// the workspace, or 0 when it is not there — then only the backstop applies.
export function citedSpansIn(report, file, totalLines = 0) {
  const spans = [];
  for (const form of citationForms(file)) {
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

// What a grader binds: the report it is reading and the workspace it was
// produced in. Returns the `citedSpans(file)` every grader used to declare
// for itself, byte-for-byte the same logic, plus the wrappers built on it.
export function citationMatchers(report, root) {
  const citedSpans = (file) => {
    let totalLines = 0;
    try { totalLines = fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).length; } catch { /* not in the workspace */ }
    return citedSpansIn(report, file, totalLines);
  };
  return {
    citedSpans,
    citesAt: (file, line) => citedSpans(file).some(([a, b]) => a <= line && line <= b),
    citesInRange: (file, from, to) => citedSpans(file).some(([a, b]) => a <= to && from <= b),
    citesNear: (file, line, slack) => citedSpans(file).some(([a, b]) => a - slack <= line && line <= b + slack),
  };
}
