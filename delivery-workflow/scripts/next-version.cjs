#!/usr/bin/env node
'use strict';
// The next semantic version for a repository, from the Conventional Commits
// since its last version tag.
//
// It prints the current version, the next one, and each commit that moved
// it. Commits without a type are listed and make the exit code 1, because
// what they changed is a decision for the owner, not for this script. Merge
// commits are skipped, since the commits they bring in are counted
// themselves.
//
// Usage: node next-version.cjs [--root <dir>] [--format text|json]
// Exit codes: 0 the version is known, 1 untyped commits need a decision,
// 2 usage or git error.

const { spawnSync } = require('child_process');
const path = require('path');
const { parse, levelOf, nextVersion, GENERATED } = require('./conventional.cjs');

const TAG = /^v?(\d+)\.(\d+)\.(\d+)$/;

function git(root, args) {
  const r = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return r.stdout;
}

// The newest tag on HEAD's history that is a version, or null.
function lastVersionTag(root) {
  const tags = git(root, ['tag', '--merged', 'HEAD', '--sort=-v:refname']).split('\n').map((t) => t.trim());
  return tags.find((t) => TAG.test(t)) || null;
}

function report(root) {
  const tag = lastVersionTag(root);
  const range = tag ? [`${tag}..HEAD`] : ['HEAD'];
  const raw = git(root, ['log', '--no-merges', '--format=%h%x1f%B%x1e', ...range]);
  const commits = raw.split('\x1e').map((s) => s.trim()).filter(Boolean).map((s) => {
    const [hash, message] = s.split('\x1f');
    return { hash, message: message.trim(), subject: message.trim().split('\n')[0] };
  });
  const current = tag ? tag.replace(/^v/, '') : '0.0.0';
  const preMajor = current.startsWith('0.');
  const typed = [];
  const untyped = [];
  for (const c of commits) {
    const parsed = parse(c.message);
    if (parsed) typed.push({ ...c, level: levelOf(parsed, preMajor) });
    else if (!GENERATED.test(c.subject)) untyped.push(c);
  }
  const { level, next } = nextVersion(current, typed.map((c) => c.message));
  return { tag, current, next, level, commits: commits.length, bumps: typed.filter((c) => c.level), untyped };
}

function text(r) {
  const lines = [`current ${r.current}${r.tag ? ` (tag ${r.tag})` : ' (no version tag yet)'}`];
  lines.push(r.level ? `next    ${r.next} (${r.level})` : `next    ${r.next} (no commit since the tag changes the version)`);
  for (const c of r.bumps) lines.push(`  ${c.level.padEnd(5)} ${c.hash} ${c.subject}`);
  if (r.untyped.length) {
    lines.push(`\n${r.untyped.length} commit(s) have no type, so the owner decides what they change:`);
    for (const c of r.untyped) lines.push(`  ${c.hash} ${c.subject}`);
  }
  return lines.join('\n');
}

module.exports = { report, lastVersionTag };

if (require.main === module) {
  const argv = process.argv.slice(2);
  let root = '.';
  let format = 'text';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--root') root = argv[++i];
    else if (argv[i] === '--format') format = argv[++i];
    else {
      console.error('Usage: node next-version.cjs [--root <dir>] [--format text|json]');
      process.exit(2);
    }
  }
  try {
    const r = report(path.resolve(root));
    console.log(format === 'json' ? JSON.stringify(r, null, 2) : text(r));
    process.exit(r.untyped.length ? 1 : 0);
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}
