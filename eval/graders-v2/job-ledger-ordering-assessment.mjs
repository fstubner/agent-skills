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
const cites = (file, line) => new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:`|\\s|:)*' + line, 'i').test(report);

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
