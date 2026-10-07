#!/usr/bin/env node
'use strict';
// Is this pull request description ready for the person who approves it?
//
// It needs to say what changed, how it was verified and what was left out on
// purpose, in the same voice as the repository's documents, with no
// attribution lines. The voice rules are the RepoDocs Vale style that ships
// with repo-docs, run through repo-docs's own runner, so there is one copy of
// them. Dated history is the point of a pull request, so that rule is off.
//
// Usage: node check-pr.js --root <dir> (--body-file <file> | --pr <number>)
//                         [--out <file>] [--no-write] [--format text|json]

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { check, runCli, readText, sectionHasContent } = require(path.join(core.lib, 'report.cjs'));
const registry = require(core.registry);

const SECTIONS = ['What changed', 'How it was verified', 'Left out on purpose'];
const ATTRIBUTION = /^(?:(?:Co-)?Authored-by:.*|.*Generated with \[?Claude.*)$/im;
const MAX_LISTED = 8;

// repo-docs is installed beside this skill, from the same suite.
function valeRunner() {
  const file = path.resolve(__dirname, '..', '..', 'repo-docs', 'scripts', 'vale-docs.cjs');
  return fs.existsSync(file) ? require(file) : null;
}

function prBody(root, args) {
  if (args['body-file']) return readText(path.resolve(args['body-file']));
  if (!args.pr) throw new Error('give --body-file <file> or --pr <number>');
  const r = spawnSync('gh', ['pr', 'view', String(args.pr), '--json', 'body', '-q', '.body'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`gh pr view ${args.pr} failed: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

function voiceCheck(body) {
  const vale = valeRunner();
  if (!vale) return check('P-voice', 'not_evaluated', 'repo-docs is not installed beside this skill, and its Vale styles hold the voice rules');
  if (!vale.valeAvailable()) return check('P-voice', 'not_evaluated', `vale is not on PATH. Install it with: ${vale.installHint()}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-pr-'));
  try {
    fs.writeFileSync(path.join(dir, 'PULL_REQUEST.md'), body);
    const result = vale.runVale(dir, ['PULL_REQUEST.md']);
    if (!result.ok) return check('P-voice', 'fail', result.reason);
    const hits = result.alerts.filter((a) => a.rule !== 'RepoDocs.History').map((a) => `line ${a.line} ${a.rule} "${a.match.trim()}"`);
    if (!hits.length) return check('P-voice', 'pass', 'no voice findings');
    const more = hits.length > MAX_LISTED ? ` (and ${hits.length - MAX_LISTED} more)` : '';
    return check('P-voice', 'fail', `${hits.length} voice findings: ${hits.slice(0, MAX_LISTED).join(' | ')}${more}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function run(root, args = {}) {
  const body = prBody(root, args).replace(/\r\n/g, '\n');
  const missing = SECTIONS.filter((s) => !sectionHasContent(body, s));
  const trailer = body.match(ATTRIBUTION);
  return [
    missing.length
      ? check('P-sections', 'fail', `missing or empty: ${missing.map((s) => `## ${s}`).join(', ')}`)
      : check('P-sections', 'pass', `has ${SECTIONS.join(', ')}`),
    voiceCheck(body),
    trailer
      ? check('P-attribution', 'fail', `attribution line "${trailer[0].trim()}"`)
      : check('P-attribution', 'pass', 'no attribution lines'),
  ];
}

module.exports = { run, SECTIONS };

if (require.main === module) {
  const artifact = registry.artifacts.find((a) => a.id === 'pr-report');
  runCli({
    skill: 'delivery-workflow',
    reportFile: artifact ? path.basename(artifact.file) : 'pr-report.json',
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
