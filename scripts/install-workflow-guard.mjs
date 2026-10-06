#!/usr/bin/env node
// Installs the delivery-workflow guard as a user-level Claude Code hook, so
// it applies in every project. It is separate from skill installation because
// it changes global harness configuration, and other hooks are left alone.
//
// Usage: node scripts/install-workflow-guard.mjs [--remove]

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Every installed command contains this path, which is how a reinstall or
// --remove finds its own entry among the user's other hooks.
const MARKER = '.agent-skills/workflow/guard.cjs';
const DIR = path.join(os.homedir(), '.agent-skills', 'workflow');
const GUARD = path.join(DIR, 'guard.cjs');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');

function main() {
  const argv = process.argv.slice(2);
  if (argv.some((a) => a !== '--remove')) {
    console.log('Usage: node scripts/install-workflow-guard.mjs [--remove]');
    process.exit(1);
  }
  const remove = argv.includes('--remove');

  let settings = {};
  if (fs.existsSync(SETTINGS)) {
    try { settings = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); }
    catch { throw new Error(`Refusing to modify invalid JSON: ${SETTINGS}`); }
  }
  settings.hooks ||= {};
  const others = (settings.hooks.PreToolUse || [])
    .filter((item) => !(item?.hooks || []).some((h) => String(h?.command || '').includes(MARKER)));
  if (remove) {
    if (others.length) settings.hooks.PreToolUse = others;
    else delete settings.hooks.PreToolUse;
    fs.rmSync(DIR, { recursive: true, force: true });
  } else {
    fs.mkdirSync(DIR, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'delivery-workflow', 'scripts', 'guard.cjs'), GUARD);
    const command = `node "${GUARD.split(path.sep).join('/')}"`;
    settings.hooks.PreToolUse = [...others, { matcher: 'Bash', hooks: [{ type: 'command', command }] }];
  }
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, `${JSON.stringify(settings, null, 2)}\n`);
  console.log(remove ? 'Removed the delivery-workflow guard.' : `Installed the delivery-workflow guard at ${GUARD}.`);
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exit(1);
}
