#!/usr/bin/env node
// Deterministic grader for engineering-assessment-silent-drop.
//
// The shape this case tests is absence. Nothing here throws, nothing looks
// obviously broken, and the program prints a number that reads as success —
// which is precisely the report the operator forwards to the partner.
//
// Planted:
//   1. cmd/importer/main.go:12-13 — os.Open and ReadAll errors discarded, so
//      a missing or malformed file imports zero rows and still prints a
//      confident "imported 0 of -1 rows".
//   2. cmd/importer/main.go:18 — rows failing validation are skipped with no
//      record of which or how many, and the printed count hides the gap the
//      README promises is reported.
//   3. internal/store/store.go:18 — Save overwrites by email, so a duplicate
//      row silently replaces an earlier subscriber's plan.
//   4. There are no tests at all. The absence is the finding.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node engineering-assessment-silent-drop.mjs --root <workspace>');
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
const citesNear = (file, line, slack = 1) => citedSpans(file).some(([a, b]) => a - slack <= line && line <= b + slack);

const discardedErr = /(ignor|discard|swallow|unchecked|blank identifier|`_`|underscore).{0,60}(error|err)|(error|err).{0,60}(ignor|discard|swallow|unchecked)/i.test(report);
record('discarded-error-cited', discardedErr && citesNear('cmd/importer/main.go', lineOf('cmd/importer/main.go', 'file, _ := os.Open'), 2),
  `issueNamed=${discardedErr}; citedNear=cmd/importer/main.go:${lineOf('cmd/importer/main.go', 'file, _ := os.Open')}`);

const silentSkip = /(silent|without (?:logging|recording|reporting)|no (?:log|record|report)|invisible|unreported|skipped rows are not)/i.test(report);
record('silent-skip-cited', silentSkip && citesNear('cmd/importer/main.go', lineOf('cmd/importer/main.go', 'continue'), 2),
  `issueNamed=${silentSkip}; citedNear=cmd/importer/main.go:${lineOf('cmd/importer/main.go', 'continue')}`);

const overwrite = /(overwrit|clobber|last (?:one )?wins|duplicate.{0,40}(replac|overwrit)|silently replac)/i.test(report);
record('overwrite-on-duplicate-cited', overwrite && citesNear('internal/store/store.go', lineOf('internal/store/store.go', 'items[s.Email] = s'), 2),
  `issueNamed=${overwrite}; citedNear=internal/store/store.go:${lineOf('internal/store/store.go', 'items[s.Email] = s')}`);

// The absence finding: there is no test file anywhere in the workspace.
const hasAnyTest = fs.existsSync(path.join(root, 'cmd', 'importer', 'main_test.go'))
  || fs.existsSync(path.join(root, 'internal', 'store', 'store_test.go'));
const namesNoTests = /(no tests|no test (?:file|coverage|suite)|zero tests|untested|nothing (?:is )?tested|absence of tests)/i.test(report);
record('missing-tests-cited', !hasAnyTest && namesNoTests, `workspaceHasTests=${hasAnyTest}; reportNamesAbsence=${namesNoTests}`);

// README says failures are reported to the partner; the code prints a count
// that cannot distinguish "all rows imported" from "half were dropped".
const docChecked = /readme|runbook/i.test(report)
  && /(claim|contradict|despite|but the code|not (?:actually|in fact)|inaccurate|does not)/i.test(report);
record('doc-claims-tested', docChecked, `docReferencedAndContradicted=${docChecked}`);

// Did anything actually get run? `go vet` and `go build` are the obvious
// commands. Measured on the sibling cases: no arm in nine runs ran the test
// command and reported its output, while the skill's rule 6 says to.
const toolAvailable = spawnSync('go', ['version'], { encoding: 'utf8' }).status === 0;
const reportsCommandOutput = /(go (?:vet|build|test)|gofmt).{0,120}(output|error|ok\b|no such|not found|exit(?:ed)?\s*(?:code\s*)?\d|clean|pass)/is.test(report)
  || /```[\s\S]{0,400}(go (?:vet|build|test)|# example\.com\/importer)/i.test(report);
record('tooling-evidence', reportsCommandOutput, `goAvailable=${toolAvailable}; reportShowsCommandOutput=${reportsCommandOutput}`);

const severity = /\b(critical|high|medium|low|blocker|p[0-3])\b/i.test(report);
const remedies = (report.match(/recommend(?:ation|ed)?|remediat|fix|return the error|log|surface|fail (?:fast|loudly)|reject|add (?:a|an)|upsert|conflict/gi) || []).length;
const confirmedSplit = /(unconfirmed|requires investigation|suspected|could not confirm|assumption)/i.test(report);
record('ranked-actionable-findings', severity && remedies >= 3 && confirmedSplit,
  `severity=${severity}; remedyTerms=${remedies}; confirmedSplit=${confirmedSplit}`);

const gaps = /(not examined|out of scope|unavailable|could not (?:check|verify|run|observe)|no access|no sample)/i.test(report);
const namesAbsent = /(partner|csv|sample data|production|operator|real import)/i.test(report);
const noAssumption = !/(imports? (?:are|is) safe|safe to repeat|data loss is unlikely)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps=${gaps}; namesAbsentInputs=${namesAbsent}; noSafetyAssumption=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'engineering-assessment-silent-drop', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
