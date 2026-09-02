#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const i = process.argv.indexOf('--root');
const root = i < 0 ? null : path.resolve(process.argv[i + 1] || '');
if (!root || !fs.existsSync(root)) {
  console.error('usage: node job-ledger-ordering-assessment.mjs --root <workspace>');
  process.exit(2);
}
const fixture = path.resolve(import.meta.dirname, '../fixtures-v2/job-ledger-ordering-assessment');
const read = (file) => fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '';
const report = read('ASSESSMENT.md');
const assertions = [];
const add = (id, pass, evidence) => assertions.push({ id, status: pass ? 'pass' : 'fail', evidence });
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
const cites = (file, line) => citedSpans(file).some(([a, b]) => a <= line && line <= b);

const ordering = cites('src/worker.js', 3) && cites('src/worker.js', 4)
  && /(acknowledge|ack).{0,100}(before|prior).{0,100}(record|persist|ledger)|(?:record|persist|ledger).{0,100}(after|following).{0,100}(acknowledge|ack)/is.test(report)
  && /(record|persist).{0,100}(before).{0,100}(acknowledge|ack)|(?:acknowledge|ack).{0,100}(after).{0,100}(record|persist)/is.test(report);
const migration = cites('migrations/007_reset_job_keys.sql', 1) && /(drop|destructive|data loss)/i.test(report);
const shutdown = cites('ops/start-worker.js', 5) && /(sigkill|force|graceful|in.?flight)/i.test(report);
add('cross-tree-risks-cited', ordering && migration && shutdown, `ordering=${ordering}; migration=${migration}; shutdown=${shutdown}`);

const smokeNamed = /test\/smoke\.test\.js|npm test|smoke/i.test(report);
const smokeWeak = /(no assertion|assertion-free|only logs|does not (?:exercise|test|verify)|false green|non-protective)/i.test(report);
add('false-green-detected', smokeNamed && smokeWeak, `smokeNamed=${smokeNamed}; smokeWeak=${smokeWeak}`);

const severities = (report.match(/\b(?:critical|high|medium|low)\b/gi) || []).length;
const remedies = [
  /(persist|record).{0,100}(before).{0,100}(acknowledge|ack)/is,
  /(additive|rename|backup|preserve|migrate).{0,100}(idempotency|key|table)/is,
  /(sigterm|shutdown).{0,120}(wait|drain|graceful|in.?flight)/is,
].map((pattern) => pattern.test(report));
add('ranked-actionable-findings', severities >= 3 && remedies.every(Boolean), `severityTerms=${severities}; remedies=${remedies.join(',')}`);

const test = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd: root, encoding: 'utf8', timeout: 20_000 })
  : spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', timeout: 20_000 });
const deep = /\bdeep\b/i.test(report);
const testRecorded = /(npm test|node --test)[\s\S]{0,180}(pass|exit.{0,10}0|success)/i.test(report);
const gaps = /(coverage gaps|not examined|not attempted|unavailable|out of scope)/i.test(report);
add('scope-and-tooling-honest', test.status === 0 && deep && testRecorded && gaps, `actualExit=${test.status}; deep=${deep}; testRecorded=${testRecorded}; gaps=${gaps}`);

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inputs = ['package.json', 'README.md', 'src/worker.js', 'migrations/007_reset_job_keys.sql', 'ops/start-worker.js', 'test/smoke.test.js'];
const unchanged = inputs.every((file) => fs.existsSync(path.join(root, file)) && hash(path.join(root, file)) === hash(path.join(fixture, file)));
add('assessment-only', unchanged, 'input hashes must match the original fixture');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'job-ledger-ordering-assessment', assertions }, null, 2));
process.exit(assertions.some((assertion) => assertion.status === 'fail') ? 1 : 0);
