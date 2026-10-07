#!/usr/bin/env node
// Installs the delivery-workflow guard as a user-level Claude Code hook, so
// it applies in every project. It is separate from skill installation because
// it changes global harness configuration, and other hooks are left alone.
//
// The guard covers only the owner's own repositories. The accounts it treats
// as the owner's go in ~/.agent-skills/workflow/config.json. They are the
// --owner values given, or else the login gh is signed in as, and an existing
// list is kept when neither is given.
//
// Usage: node scripts/install-workflow-guard.mjs [--owner <login>]... [--remove]

import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Every installed command contains this path, which is how a reinstall or
// --remove finds its own entry among the user's other hooks.
const MARKER = '.agent-skills/workflow/guard.cjs';
const DIR = path.join(os.homedir(), '.agent-skills', 'workflow');
const GUARD = path.join(DIR, 'guard.cjs');
const CONFIG = path.join(DIR, 'config.json');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const FILES = ['guard.cjs', 'conventional.cjs'];

function usage() {
  console.log('Usage: node scripts/install-workflow-guard.mjs [--owner <login>]... [--remove]');
  process.exit(1);
}

function parse(argv) {
  const out = { remove: false, owners: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--remove') out.remove = true;
    else if (argv[i] === '--owner' && argv[i + 1]) out.owners.push(argv[++i]);
    else usage();
  }
  return out;
}

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error(`Refusing to modify invalid JSON: ${file}`); }
}

function owners(given) {
  if (given.length) return given;
  const existing = readJson(CONFIG)?.owners;
  if (Array.isArray(existing) && existing.length) return existing;
  const r = spawnSync('gh', ['api', 'user', '-q', '.login'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout.trim()) {
    throw new Error('Could not read your GitHub login with gh. Sign in with gh auth login, or pass --owner <login>.');
  }
  return [r.stdout.trim()];
}

function main() {
  const args = parse(process.argv.slice(2));
  const settings = readJson(SETTINGS) || {};
  settings.hooks ||= {};
  const others = (settings.hooks.PreToolUse || [])
    .filter((item) => !(item?.hooks || []).some((h) => String(h?.command || '').includes(MARKER)));
  let covered = [];
  if (args.remove) {
    if (others.length) settings.hooks.PreToolUse = others;
    else delete settings.hooks.PreToolUse;
    fs.rmSync(DIR, { recursive: true, force: true });
  } else {
    covered = owners(args.owners);
    fs.mkdirSync(DIR, { recursive: true });
    for (const f of FILES) fs.copyFileSync(path.join(ROOT, 'delivery-workflow', 'scripts', f), path.join(DIR, f));
    fs.writeFileSync(CONFIG, `${JSON.stringify({ owners: covered }, null, 2)}\n`);
    const command = `node "${GUARD.split(path.sep).join('/')}"`;
    settings.hooks.PreToolUse = [...others, { matcher: 'Bash', hooks: [{ type: 'command', command }] }];
  }
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);
  console.log(args.remove
    ? 'Removed the delivery-workflow guard.'
    : `Installed the delivery-workflow guard at ${GUARD}. It covers repositories owned by ${covered.join(', ')}.`);
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exit(1);
}
