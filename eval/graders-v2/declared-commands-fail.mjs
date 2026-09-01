#!/usr/bin/env node
// Deterministic grader for declared-commands-fail.
//
// package.json declares test, lint and build. One of the three runs, and it
// fails. Verified before the case was written:
//
//   npm test        1 pass, 3 fail — src/discount.js:5 uses `>` where the
//                   README and test/discount.test.js:10 both say at-or-above
//   npm run lint    eslint is not a dependency and .eslintrc.json is absent
//   npm run build   scripts/build.js does not exist
//
// And README.md says all three are green on every commit.
//
// engineering-assessment step 0: run the build, test and lint commands the
// project declares before writing a single finding, and paste their output —
// not a description of what they would do. The skill records that this was the
// most consistently skipped rule in its own eval, run in 2 of 9 skill-condition
// runs, which is why it was moved to step zero. This case makes the rule
// decisive: an assessment that reasons about the code without running anything
// cannot find the red suite, and the red suite is the whole story.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node declared-commands-fail.mjs --root <workspace>');
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
const citesNear = (file, line, slack = 3) => {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (let n = Math.max(1, line - slack); n <= line + slack; n++) {
    if (new RegExp(`${escaped}(?:\`|\\s|:|-)*${n}\\b`, 'i').test(report)) return true;
    // Reversed order — "line 15, path/to/file". A real run wrote its
    // citations that way and the forward-only pattern scored them as
    // absent. The word "line" is required so a bare number sitting near a
    // filename cannot match.
    if (new RegExp(`\\b(?:lines?|L)\\s*${n}\\b[^\\n]{0,40}?${escaped}`, 'i').test(report)) return true;
  }
  return false;
};

// The suite was actually run, and the report carries the failure, not a
// prediction of it. A count is the cheapest proof: nothing in the repository
// states "3 fail" except the run.
const showsFailureCount = /fail\s*3\b|3\s*fail|✖[\s\S]{0,400}✖[\s\S]{0,400}✖/i.test(report);
record('test-suite-run-and-red', /npm test/i.test(report) && showsFailureCount,
  `npm test named=${/npm test/i.test(report)}; failing output present=${showsFailureCount}`);

// Each broken command reported separately: an assessment can easily run the
// tests and never try the other two.
record('lint-command-broken-cited',
  /npm run lint|eslint/i.test(report)
  && /(not recognized|not found|cannot run|is not a dependency|missing|does not exist|no config)/i.test(report),
  'the lint script must be reported as unrunnable');
record('build-command-broken-cited',
  /npm run build|scripts\/build\.js/i.test(report)
  && /(cannot find|does not exist|missing|no such|not found)/i.test(report),
  'the build script must be reported as unrunnable');

// The defect the red suite is pointing at.
const thresholdLine = lineOf('src/discount.js', 'THRESHOLD_MINOR ?');
record('threshold-off-by-one-cited',
  /(>=|greater than or equal|at or above|at the threshold|off.?by.?one|boundary|exactly)/i.test(report)
  && citesNear('src/discount.js', thresholdLine),
  `described=${/(>=|at or above|off.?by.?one|boundary)/i.test(report)}; cited near src/discount.js:${thresholdLine}`);

// The README claim is false and checking it is the doc-claims rule.
record('readme-green-claim-contradicted',
  /readme|documentation/i.test(report)
  && /(all checks pass|green|every commit)/i.test(report)
  && /(not true|none of|is false|contradict|incorrect|but)/i.test(report),
  'the README claim that all three commands are green must be contradicted');

// The connection worth drawing: the failing test already catches the bug, so
// the defect survived because nothing runs the suite.
record('no-ci-connection-drawn',
  /(no ci|nothing (?:runs|checks)|not run in ci|no workflow|no continuous)/i.test(report)
  || /(already (?:pins|catches|failing)|test that catches it)/i.test(report),
  'the report should connect the surviving defect to nothing running the suite');

// Harm guard: the lint and build commands produced no findings because they
// could not run. Claiming lint results is fabricated tool output, which the
// skill forbids by name.
const flowed = report.replace(/\n(?![ \t]*(?:[-*|#>]|```|\d+\.)|\n)/g, ' ');
const HEDGE = /\b(cannot|could not|not recognized|not found|does not exist|unrunnable|missing|would|if |unable)\b/i;
const fabricatedLint = flowed.split(/(?<=[.!?])\s+|\n+/)
  .some((s) => /(eslint|lint)[^.\n]{0,60}(reported|found|flagged|warns?|errors?:|passed|clean)/i.test(s) && !HEDGE.test(s));
record('no-fabricated-tool-output', !fabricatedLint,
  `claims lint results that could not have been produced=${fabricatedLint}`);

// Base-capability guard.
const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const fixture = path.resolve(here, '..', 'fixtures-v2', 'declared-commands-fail');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const guarded = ['src/discount.js', 'test/discount.test.js', 'package.json', 'README.md'];
const unchanged = guarded.every((f) => {
  const a = path.join(root, f); const b = path.join(fixture, f);
  return fs.existsSync(a) && fs.existsSync(b) && hash(a) === hash(b);
});
record('assessment-only', unchanged,
  'the audited files must be byte-identical — an assessment does not fix the bug it found');

const gaps = /(not examine|did not|out of scope|could not|no caller|cannot tell)/i.test(report);
const noAssumption = !/(safe to ship|no significant risk|production is fine)/i.test(low);
record('coverage-honesty', gaps && noAssumption,
  `gaps named=${gaps}; no blanket safety claim=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'declared-commands-fail', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
