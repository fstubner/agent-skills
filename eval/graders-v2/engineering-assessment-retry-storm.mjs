#!/usr/bin/env node
// Deterministic grader for engineering-assessment-retry-storm.
//
// Three planted risks, one assertion each — the lesson from
// engineering-assessment-hidden-risks, where a single all-or-nothing
// citation assertion could not distinguish citing none from citing two.
//
// The planted risks, in descending order of what they cost in production:
//   1. charge() retries forever with no cap and no backoff (retry storm).
//   2. `except Exception: pass` swallows every processor failure silently.
//   3. README claims idempotency and ops/deploy.md runs three replicas, but
//      no idempotency key is sent — the same order can be charged twice.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const i = process.argv.indexOf('--root');
const root = i >= 0 ? path.resolve(process.argv[i + 1]) : null;
if (!root || !fs.existsSync(root)) {
  console.error('usage: node engineering-assessment-retry-storm.mjs --root <workspace>');
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
const citesAt = (file, line) =>
  new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:`|\\s|:)*' + line, 'i').test(report);

const citations = [
  ['unbounded-retry-cited', 'app/worker.py', lineOf('app/worker.py', 'while True'),
    /(infinite|unbounded|never (?:stops|terminates)|no (?:cap|limit|backoff|ceiling)|retry storm|forever)/i],
  ['swallowed-error-cited', 'app/worker.py', lineOf('app/worker.py', 'except Exception'),
    /(swallow|silently|bare except|catch.{0,20}pass|masks?|hides? (?:the )?(?:error|failure)|no logging)/i],
  ['double-charge-cited', 'app/worker.py', lineOf('app/worker.py', 'def charge'),
    /(idempot|charged? twice|double.?charg|duplicate (?:charge|payment))/i],
];
for (const [id, file, line, issue] of citations) {
  const issueNamed = issue.test(report);
  const located = line > 0 && citesAt(file, line);
  record(id, issueNamed && located, `issueNamed=${issueNamed}; citedAt=${file}:${line}=${located}`);
}

// The README asserts idempotency and "never loses revenue"; ops/deploy.md
// runs three replicas with no rollback. An assessment that reads the docs as
// fact rather than as claims to test has not done the job.
const readsDocsAsClaims = /readme|deploy\.md|documentation/i.test(report)
  && /(claim|contradict|despite|but the code|not (?:actually |in fact )?(?:true|idempotent|supported)|inaccurate)/i.test(report);
record('doc-claims-tested', readsDocsAsClaims, `docReferenced+contradicted=${readsDocsAsClaims}`);

// tests/test_worker.py asserts that a module imports and that a constant is
// positive. It touches no retry behaviour the README says it covers.
const namesTests = /test_worker\.py|pytest|test suite/i.test(report);
const namesInadequate = /(no assertions|does not (?:exercise|test|cover)|not meaningful|only (?:checks|asserts) (?:that )?(?:the )?(?:import|module|constant)|false green|inadequate|trivial)/i.test(report);
record('false-green-detected', namesTests && namesInadequate, `namesTests=${namesTests}; namesInadequate=${namesInadequate}`);

// Did the assessment actually run anything, or only read? Measured on the
// sibling case: zero of nine runs across every condition ran the test
// command and reported its result, while the skill's own rule 6 says to.
const suite = spawnSync(process.platform === 'win32' ? 'python' : 'python3',
  ['-c', 'import ast,sys;ast.parse(open("tests/test_worker.py").read());print("parsed")'],
  { cwd: root, encoding: 'utf8', timeout: 20_000 });
const reportsCommandOutput = /(pytest|python|import).{0,80}(collected|passed|failed|error|exit(?:ed)?\s*(?:code\s*)?\d|output)/is.test(report)
  || /```[\s\S]{0,400}(pytest|Traceback|collected)/i.test(report);
record('tooling-evidence', reportsCommandOutput, `harnessCouldParse=${suite.status === 0}; reportShowsCommandOutput=${reportsCommandOutput}`);

const severity = /\b(critical|high|medium|low|blocker|p[0-3])\b/i.test(report);
const remedies = (report.match(/recommend(?:ation|ed)?|remediat|fix|replace|add (?:a|an)|cap|backoff|idempotency key|rollback/gi) || []).length;
const confirmedSplit = /(unconfirmed|requires investigation|suspected|could not confirm|assumption)/i.test(report);
record('ranked-actionable-findings', severity && remedies >= 3 && confirmedSplit,
  `severity=${severity}; remedyTerms=${remedies}; confirmedSplit=${confirmedSplit}`);

// The processor, the database and the running deployment are all absent from
// the workspace. Saying so is the skill's "what was NOT examined" rule.
const gaps = /(not examined|out of scope|unavailable|could not (?:check|verify|run|observe)|no access)/i.test(report);
const namesAbsent = /(processor|third.?party|database|production|runtime|live)/i.test(report);
const noAssumption = !/(processor (?:is|appears) reliable|production is safe|retries are safe)/i.test(low);
record('coverage-honesty', gaps && namesAbsent && noAssumption,
  `gaps=${gaps}; namesAbsentSystems=${namesAbsent}; noSafetyAssumption=${noAssumption}`);

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'engineering-assessment-retry-storm', assertions }, null, 2));
process.exit(assertions.some((a) => a.status === 'fail') ? 1 : 0);
