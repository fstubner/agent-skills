#!/usr/bin/env node
'use strict';
// Shotgun surgery, detected from git history.
//
// code-smells' own trigger names this pattern — "when a change touches the
// same handful of files every time" — but until now the skill only defined it
// in references/catalog.md and gave no way to FIND it. Every other check in
// this skill is single-file and static; this one is the opposite by nature,
// which is why it lives in its own script rather than inside check-smells.js.
//
// The signal: a change to one concept keeps forcing edits across files that
// have no structural reason to move together. Concretely, for each file A we
// ask which other files B are almost always in the same commit. If A has
// several such partners spread across different top-level directories, the
// concept those files jointly implement has no home — that is the smell, and
// the fix (per the catalog) is to give it one.
//
// Deliberately NOT in the pre-commit hook: it reads history rather than the
// staged diff, so it says nothing about the commit being made, and running
// `git log` over a large repo on every commit would be a tax with no
// per-commit signal to show for it. This is a review-time check.
//
// Usage: node check-cochange.js --root <dir> [--commits N] [--strict]
//        [--report <path>]
// Exit codes: 0 clean / not applicable, 1 findings, 3 internal error.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { check, runCli } = require(path.join(core.lib, 'report.cjs'));
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const registry = require(core.registry);

const DEFAULT_COMMITS = 200;
// Below this there isn't enough history to distinguish a pattern from a
// coincidence, and reporting one anyway would be the "confident about
// nothing" failure this suite exists to avoid.
const MIN_COMMITS = 20;
// A file must appear this many times before its co-change ratios mean
// anything. Two commits agreeing proves nothing.
const MIN_SUPPORT = 4;
// Of the commits touching A, this share must also touch B.
const CONFIDENCE = 0.7;
// How many always-together partners, in how many distinct top-level dirs,
// before it reads as a missing seam rather than normal cohesion. Files inside
// ONE directory changing together is what a well-organised module looks like;
// the smell is the spread.
const MIN_PARTNERS = 3;
const MIN_DIRS = 3;
// A reformat, rename sweep, or vendored-dependency bump touches everything and
// would manufacture co-change between unrelated files. Commits above this are
// mechanical, not conceptual.
const MAX_FILES_PER_COMMIT = 25;

const SOURCE_RE = /\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|py|rb|go|java|kt|scala|c|h|cc|cpp|hpp|cs|php|rs|swift)$/i;
const SKIP_RE = /(^|\/)(node_modules|dist|build|coverage|vendor|\.venv|__pycache__|\.next|\.turbo)\//;

function gitCommits(root, limit) {
  // --no-merges: a merge commit's file list is the union of both sides and
  // says nothing about what changed together conceptually.
  const r = spawnSync('git', [
    '-C', root, 'log', '--no-merges', '--name-only',
    '--format=%x00%H', '-n', String(limit),
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  if (r.error || r.status !== 0) return null;

  const commits = [];
  for (const chunk of r.stdout.split('\0')) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n').map((s) => s.trim()).filter(Boolean);
    const files = lines.slice(1).filter((f) => SOURCE_RE.test(f) && !SKIP_RE.test(f));
    if (files.length >= 2 && files.length <= MAX_FILES_PER_COMMIT) {
      commits.push([...new Set(files)]);
    }
  }
  return commits;
}

function topDir(file) {
  const i = file.indexOf('/');
  return i === -1 ? '.' : file.slice(0, i);
}

// Returns [{ file, partners: [{file, ratio}], dirs }] sorted worst-first.
function findShotgunSurgery(commits) {
  const total = new Map();          // file -> commits touching it
  const together = new Map();       // "A|B" -> commits touching both

  for (const files of commits) {
    for (const f of files) total.set(f, (total.get(f) || 0) + 1);
    for (let i = 0; i < files.length; i++) {
      for (let j = 0; j < files.length; j++) {
        if (i === j) continue;
        const k = files[i] + '\0' + files[j];
        together.set(k, (together.get(k) || 0) + 1);
      }
    }
  }

  const findings = [];
  for (const [file, n] of total) {
    if (n < MIN_SUPPORT) continue;
    const partners = [];
    for (const [other, m] of total) {
      if (other === file || m < MIN_SUPPORT) continue;
      const both = together.get(file + '\0' + other) || 0;
      const ratio = both / n;
      if (ratio >= CONFIDENCE) partners.push({ file: other, ratio });
    }
    if (partners.length < MIN_PARTNERS) continue;
    const dirs = new Set([topDir(file), ...partners.map((p) => topDir(p.file))]);
    if (dirs.size < MIN_DIRS) continue; // cohesive module, not a smell
    partners.sort((a, b) => b.ratio - a.ratio);
    findings.push({ file, commits: n, partners: partners.slice(0, 6), dirs: dirs.size });
  }
  findings.sort((a, b) => b.partners.length - a.partners.length || b.commits - a.commits);
  return findings;
}

function run(root, opts = {}) {
  const limit = Number(opts.commits) > 0 ? Number(opts.commits) : DEFAULT_COMMITS;

  if (!fs.existsSync(path.join(root, '.git'))) {
    return [check('S-shotgun-surgery', 'not_evaluated',
      'not a git repository (or a worktree without .git here) — this check reads commit history')];
  }
  const commits = gitCommits(root, limit);
  if (commits === null) {
    return [check('S-shotgun-surgery', 'not_evaluated', 'git log failed; history not readable')];
  }
  if (commits.length < MIN_COMMITS) {
    return [check('S-shotgun-surgery', 'not_evaluated',
      `only ${commits.length} usable commit(s) of source changes; need ${MIN_COMMITS} before a co-change pattern is distinguishable from coincidence`)];
  }

  const findings = findShotgunSurgery(commits);
  if (findings.length === 0) {
    return [check('S-shotgun-surgery', 'pass',
      `no file changes in lockstep with ${MIN_PARTNERS}+ files across ${MIN_DIRS}+ directories (scanned ${commits.length} commits)`)];
  }

  const detail = findings.slice(0, 3).map((f) => {
    const ps = f.partners.map((p) => `${p.file} ${Math.round(p.ratio * 100)}%`).join(', ');
    return `${f.file} (${f.commits} commits) moves with ${ps} across ${f.dirs} directories`;
  }).join(' | ');

  return [check('S-shotgun-surgery', 'fail',
    `${findings.length} file(s) show shotgun surgery — one concept with no home: ${detail}`)];
}

module.exports = { run, findShotgunSurgery };

if (require.main === module) {
  runCli({
    skill: 'code-smells',
    reportFile: registry.artifacts.find((a) => a.id === 'cochange-report')?.file
      || 'cochange-report.json',
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
    evidenceDir: registry.evidenceDir,
  });
}
