#!/usr/bin/env node
'use strict';
// A Claude Code PreToolUse hook for Bash. It refuses the git and gh commands
// the delivery workflow forbids, so the rules hold even when a session
// forgets them:
//
//   - a commit or a push straight to the default branch
//   - a force push, other than --force-with-lease to a working branch
//   - deleting a branch or tag on a remote
//   - a release that isn't a draft, publishing a draft, or a second release
//     on the same day
//   - an attribution trailer in a commit message
//   - merging a pull request with --admin, which skips branch protection
//
// The rules apply only in a repository with an origin remote, because a
// local-only repository has no pull request to go through. Exit code 2 tells
// Claude Code to block the call and show the reason to the agent.
//
// Install it with scripts/install-workflow-guard.mjs from the agent-skills
// repository.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ATTRIBUTION = /^(?:(?:Co-)?Authored-by:.*|(?:🤖\s*)?Generated with \[?[A-Z].*)$/im;

// Splits a shell command line into simple commands, each a list of words.
// Quotes are honoured, and ; && || | & and newlines separate commands. It is
// not a shell, and it does not need to be: a command it can't read is
// allowed, and the branch protection on GitHub still holds.
function splitCommands(line) {
  const commands = [];
  let words = [];
  let word = '';
  let inWord = false;
  let quote = null;
  const endWord = () => { if (inWord) words.push(word); word = ''; inWord = false; };
  const endCommand = () => { endWord(); if (words.length) commands.push(words); words = []; };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      // Inside double quotes a backslash escapes only these, as in bash, so a
      // quoted Windows path keeps its backslashes.
      else if (c === '\\' && quote === '"' && '$`"\\\n'.includes(line[i + 1] || 'x')) word += line[++i];
      else word += c;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; inWord = true; continue; }
    if (c === '\\' && i + 1 < line.length) { word += line[++i]; inWord = true; continue; }
    if (c === ' ' || c === '\t') { endWord(); continue; }
    if (c === ';' || c === '\n' || c === '|' || c === '&') { endCommand(); continue; }
    word += c;
    inWord = true;
  }
  endCommand();
  return commands;
}

function git(dir, args) {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

// The default branch of the repository at `dir`, or null when it has no
// origin remote and the rules don't apply.
function defaultBranch(dir) {
  if (!git(dir, ['remote', 'get-url', 'origin'])) return null;
  const head = git(dir, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  if (head) return head.replace(/^origin\//, '');
  for (const name of ['main', 'master']) {
    if (git(dir, ['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${name}`])) return name;
  }
  return 'main';
}

// git's own options before the subcommand: -C <dir>, -c <k=v> and flags.
function gitSubcommand(words, cwd) {
  let dir = cwd;
  let i = 1;
  while (i < words.length && words[i].startsWith('-')) {
    if (words[i] === '-C') { dir = path.resolve(dir, words[i + 1] || '.'); i += 2; } else if (words[i] === '-c') i += 2;
    else i += 1;
  }
  return { dir, sub: words[i], args: words.slice(i + 1) };
}

function commitReasons(dir, args) {
  const reasons = [];
  const main = defaultBranch(dir);
  if (main && git(dir, ['branch', '--show-current']) === main) {
    reasons.push(`this commits straight to ${main}. Create a branch first, and the work reaches ${main} through a pull request`);
  }
  for (let i = 0; i < args.length; i++) {
    let text = null;
    if (args[i] === '-m' || args[i] === '--message') text = args[i + 1];
    else if (args[i].startsWith('--message=')) text = args[i].slice(10);
    else if (args[i] === '-F' || args[i] === '--file') {
      try { text = fs.readFileSync(path.resolve(dir, args[i + 1]), 'utf8'); } catch { text = null; }
    }
    if (text && ATTRIBUTION.test(text)) {
      reasons.push('the commit message has an attribution trailer. Remove the Co-Authored-By or "Generated with" line');
      break;
    }
  }
  return reasons;
}

function pushReasons(dir, args) {
  const main = defaultBranch(dir);
  if (!main) return [];
  const reasons = [];
  const flags = args.filter((a) => a.startsWith('-'));
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (['-o', '--push-option', '--repo', '--receive-pack', '--exec'].includes(args[i])) { i++; continue; }
    if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  const refspecs = positional.slice(1);
  if (flags.some((f) => f === '--force' || f === '-f' || /^-[a-z]*f[a-z]*$/.test(f)) || refspecs.some((r) => r.startsWith('+'))) {
    reasons.push('force pushes are refused. On a working branch, use --force-with-lease');
  }
  if (flags.some((f) => f === '--delete' || f === '-d') || refspecs.some((r) => r.startsWith(':'))) {
    reasons.push('this deletes a branch or tag on the remote. Ask the user to do it');
  }
  if (flags.some((f) => f === '--all' || f === '--mirror' || f === '--branches')) {
    reasons.push(`pushing every branch includes ${main}. Push the working branch by name`);
  }
  const current = git(dir, ['branch', '--show-current']);
  const targets = refspecs.length ? refspecs.map((r) => r.replace(/^\+/, '').split(':').pop()) : [current];
  const named = (t) => t === main || t === `refs/heads/${main}` || (t === 'HEAD' && current === main);
  if (targets.some((t) => t && named(t))) {
    reasons.push(`this pushes to ${main}. Push a branch and open a pull request`);
  }
  return reasons;
}

function ghRepoArgs(words) {
  const i = words.findIndex((w) => w === '-R' || w === '--repo');
  return i >= 0 ? ['--repo', words[i + 1]] : [];
}

function today(now) {
  const d = now();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function localDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function releaseCreateReasons(words, cwd, env) {
  const reasons = [];
  const args = words.slice(3);
  if (!args.some((a) => a === '--draft' || a === '-d' || a === '--draft=true')) {
    reasons.push('releases are created as drafts. Add --draft, and the user publishes it');
  }
  const r = env.gh(['release', 'list', '--limit', '10', '--json', 'createdAt,tagName', ...ghRepoArgs(words)], cwd);
  let list = null;
  try { list = JSON.parse(r.stdout); } catch { list = null; }
  if (r.status !== 0 || !Array.isArray(list)) {
    reasons.push('the release cadence could not be checked, because gh release list failed. Check it, then ask the user');
  } else {
    const same = list.find((rel) => localDate(rel.createdAt) === today(env.now));
    if (same) reasons.push(`${same.tagName} was already created today, and the limit is one release a day`);
  }
  return reasons;
}

function ghReasons(words, cwd, env) {
  const [, a, b] = words;
  if (a === 'release' && b === 'create') return releaseCreateReasons(words, cwd, env);
  if (a === 'release' && b === 'edit') {
    const i = words.indexOf('--draft');
    if (words.includes('--draft=false') || (i >= 0 && words[i + 1] === 'false')) {
      return ['this publishes a draft release. Publishing is the user\'s step'];
    }
  }
  if (a === 'pr' && b === 'merge' && words.includes('--admin')) {
    return ['--admin skips branch protection. Merge once the checks pass'];
  }
  if (a === 'api') {
    const text = words.join(' ');
    if (/releases/.test(text) && /draft\s*=\s*false/i.test(text)) return ['this publishes a draft release. Publishing is the user\'s step'];
    if (/(?:-X|--method)\s+DELETE/i.test(text) && /\/git\/refs\//.test(text)) return ['this deletes a branch or tag on the remote. Ask the user to do it'];
  }
  return [];
}

const defaultEnv = {
  now: () => new Date(),
  gh: (args, cwd) => spawnSync('gh', args, { cwd, encoding: 'utf8', timeout: 15000 }),
};

// Every reason the command line is refused, or an empty list.
function evaluate(line, cwd, env = defaultEnv) {
  const reasons = [];
  let dir = cwd;
  for (let words of splitCommands(line)) {
    while (words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[0])) words = words.slice(1);
    if (!words.length) continue;
    if (words[0] === 'cd') { dir = path.resolve(dir, words[1] || '.'); continue; }
    if (words[0] === 'git') {
      const { dir: repo, sub, args } = gitSubcommand(words, dir);
      if (sub === 'commit') reasons.push(...commitReasons(repo, args));
      if (sub === 'push') reasons.push(...pushReasons(repo, args));
    } else if (words[0] === 'gh') {
      reasons.push(...ghReasons(words, dir, env));
    }
  }
  return [...new Set(reasons)];
}

module.exports = { evaluate, splitCommands };

if (require.main === module) {
  let input;
  try { input = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
  const command = input?.tool_input?.command;
  if (input?.tool_name !== 'Bash' || typeof command !== 'string') process.exit(0);
  const reasons = evaluate(command, input.cwd || process.cwd());
  if (reasons.length) {
    console.error(`delivery-workflow guard refused this command:\n${reasons.map((r) => `- ${r}`).join('\n')}`);
    process.exit(2);
  }
}
