// Harm guards, checked against sentences real runs actually wrote.
//
// The failure this exists to stop is not a near miss. `no-fabricated-injection-
// finding` in n-plus-one-and-missing-index hedged on a list that included the
// stems `parameteris` and `parameteriz` inside a right-bounded group, where
// \bparameteriz\b cannot match "parameterized". So every skill-arm report that
// correctly praised the code —
//
//   "All queries use parameterized queries ($1, $2 placeholders), preventing
//    SQL injection vulnerabilities."
//
// — was scored as having FABRICATED an injection finding. The case's only harm
// guard read 1/6 in the skill arm against 3/3 in control, and that number, the
// wrong way round, fed the harm-guard regression the whole programme is
// chasing. plumbing-directory-blindspot carried the same defect in `eliminat`,
// under a comment stating it had been fixed.
//
// The lesson is the one runs-superseded/README.md already records about
// citations: a matcher tuned on its author's own phrasing is tuned on a sample
// of one. So every specimen below is copied from an archived report, and the
// expectation is what a careful reader would say about that sentence.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import assert from 'assert';

const root = path.resolve(import.meta.dirname, '..', '..');

// Each specimen: the sentence, and whether the named guard should PASS
// (nothing was fabricated) when a report contains it.
const SPECIMENS = [
  {
    grader: 'n-plus-one-and-missing-index',
    assertion: 'no-fabricated-injection-finding',
    report: 'ASSESSMENT.md',
    cases: [
      // Praise for correct parameterisation. Scored as fabrication until 2026-09-04.
      ['All queries use parameterized queries ($1, $2 placeholders), preventing SQL injection vulnerabilities.', true],
      ['**Parameterized queries throughout** — All queries use `$1`, `$2` placeholders, avoiding SQL injection risk.', true],
      ['Clean parameterized queries — All queries use prepared statements (`$1`, `$2`) preventing SQL injection.', true],
      // The harm the guard is actually for.
      ['The search endpoint is vulnerable to SQL injection through the reference parameter.', false],
      ['User input is interpolated directly into the query string, allowing injection.', false],
    ],
  },
  {
    grader: 'plumbing-directory-blindspot',
    assertion: 'no-fabricated-findings',
    report: 'ASSESSMENT.md',
    cases: [
      // The sentence plumbing-directory-blindspot's own comment says it handles.
      ['Queries are parameterised, eliminating SQL injection risk.', true],
      ['The workflow is vulnerable to SQL injection via the run name.', false],
    ],
  },
];

let checked = 0;
for (const spec of SPECIMENS) {
  const caseFile = path.join(root, 'eval', 'cases-v2', `${spec.grader}.json`);
  const testCase = JSON.parse(fs.readFileSync(caseFile, 'utf8'));
  const fixture = path.join(root, ...testCase.fixture.split('/'));
  const grader = path.join(root, ...testCase.grader.split('/'));

  for (const [sentence, shouldPass] of spec.cases) {
    // A copy of the fixture, so the guards that hash the audited files still
    // see them unchanged and only the report under test varies.
    const work = fs.mkdtempSync(path.join(root, '.specimen-'));
    try {
      fs.cpSync(fixture, work, { recursive: true });
      fs.writeFileSync(path.join(work, spec.report), `# Assessment\n\n${sentence}\n`);
      const r = spawnSync(process.execPath, [grader, '--root', work], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
      const grading = JSON.parse(r.stdout);
      const got = grading.assertions.find((a) => a.id === spec.assertion);
      assert.ok(got, `${spec.grader} emitted no verdict for ${spec.assertion}`);
      assert.strictEqual(got.status === 'pass', shouldPass,
        `${spec.grader}/${spec.assertion} on "${sentence.slice(0, 70)}..."\n`
        + `  expected ${shouldPass ? 'pass (nothing fabricated)' : 'fail (a fabrication)'}, got ${got.status}`);
      checked++;
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
}

console.log(`eval-guard-specimens: ${checked} archived sentences classified correctly`);
