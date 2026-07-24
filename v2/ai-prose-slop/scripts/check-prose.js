#!/usr/bin/env node
'use strict';
// Shells out to a real `vale` binary — this checks real Vale output, not a
// reimplementation of its rule engine. See ../SKILL.md rule 3.
//
// Deliberately self-contained (no core/lib dependency) so the skill and its
// Vale style stay copy-anywhere, but it emits the suite's unified report
// shape: { schemaVersion, skill, generatedAt, root, verdict, checks }.
// Alert mapping: vale error => fail (BLOCK); warning/suggestion =>
// not_evaluated (CONDITIONAL — advisory findings need a human judgment
// pass, they are never auto-SHIP and never auto-BLOCK).
//
// Usage: node check-prose.js <file-or-dir...> [--strict] [--report <path>]
// Exit codes: 0 clean (or advisory findings without --strict), 1 error-level
// findings or --strict with findings or vale errored, 2 vale not installed.

const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const skillRoot = path.resolve(__dirname, '..');
const stylesPath = path.join(skillRoot, 'rules');

function parseArgs(argv) {
  const out = { targets: [], strict: false, reportPath: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--strict') out.strict = true;
    else if (a === '--report') out.reportPath = argv[++i];
    else out.targets.push(a);
  }
  if (out.targets.length === 0) out.targets.push('.');
  return out;
}

function installHint() {
  if (process.platform === 'win32') return 'winget install errata-ai.Vale  (or: scoop install vale)';
  if (process.platform === 'darwin') return 'brew install vale';
  return 'See https://vale.sh/docs/vale-cli/installation/ or download a release from https://github.com/errata-ai/vale/releases';
}

function isValeOnPath() {
  const probe = spawnSync('vale', ['--version'], { encoding: 'utf8' });
  if (probe.error && probe.error.code === 'ENOENT') return false;
  return probe.status === 0;
}

function makeReport(checks) {
  const verdict = checks.some((c) => c.status === 'fail') ? 'BLOCK'
    : checks.some((c) => c.status === 'not_evaluated') ? 'CONDITIONAL'
    : 'SHIP';
  return {
    schemaVersion: 1,
    skill: 'ai-prose-slop',
    generatedAt: new Date().toISOString(),
    root: process.cwd(),
    verdict,
    checks,
  };
}

function finish(checks, args, exitCode) {
  const report = makeReport(checks);
  const json = JSON.stringify(report, null, 2);
  if (args.reportPath) fs.writeFileSync(args.reportPath, json + '\n');
  console.log(json);
  process.exit(exitCode);
}

const args = parseArgs(process.argv.slice(2));

if (!isValeOnPath()) {
  finish([{
    id: 'vale-missing',
    status: 'not_evaluated',
    detail:
      `vale is not on PATH — this skill checks real Vale output, not a reimplementation. ` +
      `Offer to install it, then re-run. Install: ${installHint()}`,
  }], args, 2);
}

// A private, freshly-created directory rather than a predictable
// os.tmpdir() filename — on a shared multi-user machine, a predictable path
// written with writeFileSync (which follows an existing symlink) is an
// arbitrary-file-overwrite risk if another local user pre-creates it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-prose-slop-'));
const tmpConfig = path.join(tmpDir, 'vale.ini');
fs.writeFileSync(tmpConfig, [
  `StylesPath = ${stylesPath.split(path.sep).join('/')}`,
  'MinAlertLevel = suggestion',
  '',
  '[*.md]',
  'BasedOnStyles = AIProseTells',
  '',
].join('\n'));

let result;
try {
  // The `--` separator stops a target starting with `-` (e.g. a file
  // literally named `--verbose`) from being parsed as a vale flag.
  result = spawnSync('vale', ['--config', tmpConfig, '--output=JSON', '--', ...args.targets], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

if (result.error) {
  finish([{ id: 'vale-error', status: 'fail', detail: result.error.message }], args, 1);
}

// With --output=JSON, vale exits 0 whether or not alerts were found —
// verified empirically (a clean doc and a doc with dozens of alerts both
// exit 0). A non-zero exit here means vale itself failed to run (bad
// config, a style file with an invalid key, a crash), never "findings
// present". This check is load-bearing: on that failure path vale prints
// its error as JSON to STDERR and leaves stdout empty, and
// `JSON.parse(stdout || '{}')` below would otherwise silently parse the
// empty stdout as "{}" (zero alerts) and report a clean SHIP — a broken
// style (e.g. a rule file that fails vale's own key-schema validation)
// would pass every check instead of blocking.
if (result.status !== 0) {
  finish([{
    id: 'vale-crashed',
    status: 'fail',
    detail: `vale exited ${result.status} instead of completing normally — this is a broken check, not a clean one; stderr: ${(result.stderr || '').slice(0, 500)}`,
  }], args, 1);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout || '{}');
} catch (e) {
  finish([{
    id: 'vale-parse-error',
    status: 'fail',
    detail: `Could not parse vale output as JSON: ${e.message}; stderr: ${(result.stderr || '').slice(0, 400)}`,
  }], args, 1);
}

const checks = [];
for (const [file, alerts] of Object.entries(parsed)) {
  for (const alert of alerts) {
    checks.push({
      id: alert.Check,
      status: alert.Severity === 'error' ? 'fail' : 'not_evaluated',
      detail: `${file}:${alert.Line} ${alert.Message} [${alert.Match}]`,
    });
  }
}

const hasError = checks.some((c) => c.status === 'fail');
const exitCode = hasError ? 1 : args.strict && checks.length > 0 ? 1 : 0;
finish(checks, args, exitCode);
