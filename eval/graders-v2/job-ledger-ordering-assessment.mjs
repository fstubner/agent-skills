#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { citationMatchers } from './lib/citations.mjs';

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
// The citation matcher is shared: eval/graders-v2/lib/citations.mjs. Twenty-
// three private copies needed four separate repairs; this grader keeps only
// its own wrappers below.
const { citedSpans } = citationMatchers(report, root);
const cites = (file, line) => citedSpans(file).some(([a, b]) => a <= line && line <= b);

// One assertion per planted risk, at revision 2.
//
// These were a single all-or-nothing conjunction, which is the mistake already
// recorded in the header of engineering-assessment-retry-storm: a combined
// citation assertion cannot tell citing none from citing two. Measured on 22
// archived runs of this case before the split, the three clauses scored
// 0, 12 and 2 out of 22 — three quite different facts reported as one zero,
// and the case contributed a flat 0 to every arm while distinguishing nothing.
//
// Citing either line of the ack/record pair is enough. Requiring both was the
// old rule and it is not what the finding is: reports name the ordering defect
// and point at one line of it, which locates the defect exactly.
const orderingDescribed = /(acknowledge|ack).{0,100}(before|prior).{0,100}(record|persist|ledger)|(?:record|persist|ledger).{0,100}(after|following).{0,100}(acknowledge|ack)/is.test(report)
  && /(record|persist).{0,100}(before).{0,100}(acknowledge|ack)|(?:acknowledge|ack).{0,100}(after).{0,100}(record|persist)/is.test(report);
const orderingCited = cites('src/worker.js', 3) || cites('src/worker.js', 4);
add('ordering-risk-cited', orderingDescribed && orderingCited,
  `described=${orderingDescribed}; citedAt=src/worker.js:3|4=${orderingCited}`);

const migrationDescribed = /(drop|destructive|data loss)/i.test(report);
const migrationCited = cites('migrations/007_reset_job_keys.sql', 1);
add('migration-risk-cited', migrationDescribed && migrationCited,
  `described=${migrationDescribed}; citedAt=migrations/007_reset_job_keys.sql:1=${migrationCited}`);

const shutdownDescribed = /(sigkill|force|graceful|in.?flight)/i.test(report);
const shutdownCited = cites('ops/start-worker.js', 5);
add('shutdown-risk-cited', shutdownDescribed && shutdownCited,
  `described=${shutdownDescribed}; citedAt=ops/start-worker.js:5=${shutdownCited}`);

const smokeNamed = /test\/smoke\.test\.js|npm test|smoke/i.test(report);
const smokeWeak = /(no assertion|assertion-free|only logs|does not (?:exercise|test|verify)|false green|non-protective)/i.test(report);
add('false-green-detected', smokeNamed && smokeWeak, `smokeNamed=${smokeNamed}; smokeWeak=${smokeWeak}`);

// Two constructs, and the old rule got both halves wrong. It scored 1 of 21
// archived reports.
//
// Counting severity WORDS passed 21 of 21 — a clause that never discriminated
// anything. Ranked means the findings are DIFFERENTIATED, so the measure is
// distinct severity levels, not how often a severity word appears. That still
// fails one report of the 21, so it is not free either.
//
// Requiring all three remedies ANDed three roughly-even events (9/21, 7/21,
// 12/21) down to almost nothing. It also re-tested finding all three risks,
// which the three per-risk assertions above now do on their own. Two of three
// is the rule because the prompt asks for "the four highest-value confirmed
// findings" out of more than four real ones — leaving one planted risk out of
// the report is an editorial choice the prompt invites, and this assertion is
// about the quality of the remedies offered, not the count of risks found.
//
// Measured after the change: 7 of 21, against 12/30 and 9/30 on the sibling
// engineering-assessment cases.
const severityLevels = new Set((report.match(/\b(?:critical|high|medium|low)\b/gi) || []).map((s) => s.toLowerCase()));
const remedies = [
  /(persist|record).{0,100}(before).{0,100}(acknowledge|ack)/is,
  /(additive|rename|backup|preserve|migrate).{0,100}(idempotency|key|table)/is,
  /(sigterm|shutdown).{0,120}(wait|drain|graceful|in.?flight)/is,
].map((pattern) => pattern.test(report));
const remedyCount = remedies.filter(Boolean).length;
add('ranked-actionable-findings', severityLevels.size >= 2 && remedyCount >= 2,
  `severityLevels=${[...severityLevels].sort().join('|') || 'none'}; remedies=${remedyCount}/3 [${remedies.join(',')}]`);

const test = process.platform === 'win32'
  ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm test'], { cwd: root, encoding: 'utf8', timeout: 20_000 })
  : spawnSync('npm', ['test'], { cwd: root, encoding: 'utf8', timeout: 20_000 });
const deep = /\bdeep\b/i.test(report);
const testRecorded = /(npm test|node --test)[\s\S]{0,180}(pass|exit.{0,10}0|success)/i.test(report);
const gaps = /(coverage gaps|not examined|not attempted|unavailable|out of scope)/i.test(report);
add('scope-and-tooling-honest', test.status === 0 && deep && testRecorded && gaps, `actualExit=${test.status}; deep=${deep}; testRecorded=${testRecorded}; gaps=${gaps}`);

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inputs = ['package.json', 'README.md', 'src/main.js', 'src/worker.js', 'migrations/007_reset_job_keys.sql', 'ops/start-worker.js', 'test/smoke.test.js'];
const unchanged = inputs.every((file) => fs.existsSync(path.join(root, file)) && hash(path.join(root, file)) === hash(path.join(fixture, file)));
add('assessment-only', unchanged, 'input hashes must match the original fixture');

console.log(JSON.stringify({ schemaVersion: 2, caseId: 'job-ledger-ordering-assessment', assertions }, null, 2));
process.exit(assertions.some((assertion) => assertion.status === 'fail') ? 1 : 0);
