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
  //
  // `name` is escaped before interpolation: it comes from registry.json's
  // requiredHeadings, and an unescaped metacharacter there either crashed the
  // checker (a heading like "C++" threw "Nothing to repeat", surfacing as an
  // exit-3 internal error rather than a validation failure) or silently matched
  // the wrong thing (a name of ".*" matched any heading at all).
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^#{1,6}\\s+${escaped}\\b`, 'im').test(text);
}

// hasHeading's stricter sibling: the heading must exist AND have something
// under it. v0.4's gate was vacuous because a bare mention in prose satisfied
// it; that was fixed, but the SAME vacuity survived one level down — an
// ARCHITECTURE.md consisting of "## Parts\n\n## Boundaries\n\n## Trust\n"
// passed every section check and shipped, which is exactly the document the
// gate exists to reject. Found by adversarial probe, 2026-08-02.
//
// HTML comments do NOT count as content, deliberately: every template in
// assets/ uses them for guidance, so a copied-but-unfilled template must
// fail rather than pass on its own instructions.
function sectionHasContent(text, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = new RegExp(`^(#{1,6})\\s+${escaped}\\b[^\\n]*$`, 'im').exec(text);
  if (!start) return false;

  const level = start[1].length;
  const after = text.slice(start.index + start[0].length);
  // Stop at the next heading of the same or higher rank; deeper subheadings
  // are part of this section and their content counts toward it.
  const next = new RegExp(`^#{1,${level}}\\s+\\S`, 'm').exec(after);
  const body = next ? after.slice(0, next.index) : after;

  const meaningful = body
    .replace(/<!--[\s\S]*?-->/g, '')   // template guidance comments
    .replace(/^[\s>*+-]+$/gm, '')      // empty list markers / blockquote gutters
    .trim();
  if (meaningful.length < 3) return false;
  const content = meaningful
    .replace(/^[\s>*+\-\d.)]+/gm, '')
    .replace(/[`*_\[\]]/g, '')
    .trim();
  // A copied template with placeholder prose is still empty evidence.
  return !/^(?:(?:todo|tbd|placeholder|coming soon|fill (?:this|me) in|\.\.\.)[.!]?\s*)+$/i.test(content);
}

function check(id, status, detail = '') {
  if (!['pass', 'fail', 'not_evaluated'].includes(status)) {
    throw new Error(`invalid check status "${status}" for ${id}`);
  }
  return { id, status, detail };
}

function computeVerdict(checks) {
  // Zero checks means nothing was evaluated — never a ship. A producer that
  // crashed early, was gutted, or short-circuited used to emit [] and be
  // recorded by accept-check as a passing producer.
  if (!Array.isArray(checks) || checks.length === 0) return 'CONDITIONAL';
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

// --out may be absolute (used as-is), relative (joined to root), or absent
// (root/evidenceDir/defaultFileName). path.join does NOT special-case an
// absolute second argument the way path.resolve does, so computing this via
// join(root, dirname(absoluteOut)) — the previous approach — produced a
// nonsense nested path and crashed; isAbsolute is checked explicitly instead.
function resolveReportPath(root, evidenceDir, defaultFileName, outArg) {
  if (outArg) {
    return path.isAbsolute(outArg) ? outArg : path.join(root, outArg);
  }
  return path.join(root, evidenceDir, defaultFileName);
}

function writeReport(outPath, report) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
  return outPath;
}

// Shared CLI wrapper: every checker's bin behavior is identical by
// construction. runFn(root) must return an array of checks.
// Exit codes: 0 SHIP/CONDITIONAL, 1 BLOCK (or CONDITIONAL with --strict),
// 3 checker crashed. Crashes are loud, never green.
// The verdict is the one thing a person reads, and it was only ever
// available as a 40-line JSON dump. JSON stays the default for anything
// that is not a terminal, because the acceptance gate spawns these
// checkers and parses stdout — changing that default would break the gate
// silently, which is the failure class this suite exists to prevent.
//
// So: a pipe gets JSON, a terminal gets prose, and --format overrides both.
function formatText(report) {
  const lines = [];
  const failed = report.checks.filter((c) => c.status === 'fail');
  const unevaluated = report.checks.filter((c) => c.status === 'not_evaluated');
  lines.push(`${report.verdict}  ${report.skill}  (${report.root})`);

  // Failures first and in full — they are the reason to read this at all.
  for (const c of failed) lines.push(`  FAIL  ${c.id}: ${c.detail}`);
  for (const c of unevaluated) lines.push(`  --    ${c.id}: ${c.detail}`);
  const passed = report.checks.length - failed.length - unevaluated.length;
  if (passed > 0) lines.push(`  ok    ${passed} check(s) passed`);

  if (report.verdict === 'BLOCK') {
    lines.push('', 'Fix the FAIL line(s) above and re-run. Nothing ships on a BLOCK.');
  } else if (report.verdict === 'CONDITIONAL') {
    lines.push('', 'Nothing failed, but the -- line(s) could not be evaluated —');
    lines.push('that is missing evidence, not a pass. Resolve them or say so out loud.');
  }
  return lines.join('\n');
}

function chooseFormat(args) {
  const explicit = args.format;
  if (explicit === 'text' || explicit === 'json') return explicit;
  if (explicit) throw new Error(`unknown --format "${explicit}" (expected: text, json)`);
  return process.stdout.isTTY ? 'text' : 'json';
}

function runCli({ skill, reportFile, runFn, argv, parseArgs, evidenceDir }) {
  let args;
  try {
    args = parseArgs(argv, { booleans: ['strict', 'no-write', 'runtime-verified'] });
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(3);
  }
  const root = path.resolve(args.root || '.');
  // Resolved before the work starts: a bad --format is a usage error, and
  // reporting it as "checker crashed" with a stack trace would be this
  // suite failing its own cli-tooling rules in its own output.
  let format;
  try {
    format = chooseFormat(args);
  } catch (e) {
    console.error(String(e.message || e));
    process.exit(2);
  }
  try {
    const checks = runFn(root, args);
    const report = makeReport(skill, root, checks);
    if (!args['no-write']) {
      writeReport(resolveReportPath(root, evidenceDir, reportFile, args.out), report);
    }
    console.log(format === 'text' ? formatText(report) : JSON.stringify(report, null, 2));
    if (report.verdict === 'BLOCK') process.exit(1);
    if (report.verdict === 'CONDITIONAL' && args.strict) process.exit(1);
    process.exit(0);
  } catch (e) {
    console.error(`${skill} checker crashed: ${e.stack || e}`);
    process.exit(3);
  }
}

module.exports = { readText, hasHeading, sectionHasContent, check, computeVerdict, makeReport, writeReport, resolveReportPath, runCli, formatText, chooseFormat };
