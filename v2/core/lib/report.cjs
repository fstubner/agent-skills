'use strict';

// Unified report shape + shared CLI runner for every checker in the suite.
// ONE check shape everywhere: { id, status: pass|fail|not_evaluated, detail }.
// ONE verdict rule everywhere: any fail => BLOCK; else any not_evaluated =>
// CONDITIONAL; else SHIP. Missing evidence can never read as success.

const fs = require('fs');
const path = require('path');

function readText(p) {
  // CRLF-normalized read — no check in this suite may be line-ending sensitive.
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}

function hasHeading(text, name) {
  // Real markdown headings only. A bare mention of the word "Users" in prose
  // must not satisfy a section requirement (v0.4's gate was vacuous).
  return new RegExp(`^#{1,6}\\s+${name}\\b`, 'im').test(text);
}

function check(id, status, detail = '') {
  if (!['pass', 'fail', 'not_evaluated'].includes(status)) {
    throw new Error(`invalid check status "${status}" for ${id}`);
  }
  return { id, status, detail };
}

function computeVerdict(checks) {
  if (checks.some((c) => c.status === 'fail')) return 'BLOCK';
  if (checks.some((c) => c.status === 'not_evaluated')) return 'CONDITIONAL';
  return 'SHIP';
}

function makeReport(skill, root, checks) {
  return {
    schemaVersion: 1,
    skill,
    generatedAt: new Date().toISOString(),
    root: path.resolve(root),
    verdict: computeVerdict(checks),
    checks,
  };
}

function writeReport(root, evidenceDir, fileName, report) {
  const dir = path.join(root, evidenceDir);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, fileName);
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  return out;
}

// Shared CLI wrapper: every checker's bin behavior is identical by
// construction. runFn(root) must return an array of checks.
// Exit codes: 0 SHIP/CONDITIONAL, 1 BLOCK (or CONDITIONAL with --strict),
// 3 checker crashed. Crashes are loud, never green.
function runCli({ skill, reportFile, runFn, argv, parseArgs, evidenceDir }) {
  let args;
  try {
    args = parseArgs(argv, { booleans: ['strict', 'no-write'] });
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(3);
  }
  const root = path.resolve(args.root || '.');
  try {
    const checks = runFn(root, args);
    const report = makeReport(skill, root, checks);
    if (!args['no-write']) {
      writeReport(root, args.out ? path.dirname(args.out) : evidenceDir,
        args.out ? path.basename(args.out) : reportFile, report);
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.verdict === 'BLOCK') process.exit(1);
    if (report.verdict === 'CONDITIONAL' && args.strict) process.exit(1);
    process.exit(0);
  } catch (e) {
    console.error(`${skill} checker crashed: ${e.stack || e}`);
    process.exit(3);
  }
}

module.exports = { readText, hasHeading, check, computeVerdict, makeReport, writeReport, runCli };
