#!/usr/bin/env node
// Installs harness-native, user-level hooks without replacing existing hooks.
// This is explicit and separate from skill installation because it modifies
// global harness configuration and records local usage metadata.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HARNESSES = ['claude', 'codex', 'cursor', 'antigravity'];
const MARKER = 'agent-skills-telemetry';
const ADAPTER_DIR = path.join(os.homedir(), '.agent-skills-telemetry', 'adapter');
const ADAPTER = path.join(ADAPTER_DIR, 'log-skill-invocation.mjs');

function usage(code = 0) {
  console.log('Usage: node scripts/install-telemetry.mjs --harness claude|codex|cursor|antigravity|all [--remove]');
  process.exit(code);
}

function parseArgs(argv) {
  const out = { remove: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--harness') out.harness = argv[++i];
    else if (argv[i] === '--remove') out.remove = true;
    else if (argv[i] === '--help' || argv[i] === '-h') usage(0);
    else usage(1);
  }
  if (!out.harness || (out.harness !== 'all' && !HARNESSES.includes(out.harness))) usage(1);
  return out;
}

function loadConfig(file, initial) {
  if (!fs.existsSync(file)) return structuredClone(initial);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error(`Refusing to modify invalid JSON: ${file}`); }
}

function saveConfig(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function command(harness) {
  return `node "${ADAPTER}" --harness ${harness}`;
}

function withoutTelemetry(items = []) {
  return items.filter((item) => !String(item?.command || '').includes(MARKER)
    && !(item?.hooks || []).some((hook) => String(hook?.command || '').includes(MARKER)));
}

function installArrayHook(file, initial, event, definition, remove) {
  const config = loadConfig(file, initial);
  config.hooks ||= {};
  const current = withoutTelemetry(config.hooks[event]);
  config.hooks[event] = remove ? current : [...current, definition];
  saveConfig(file, config);
}

function configure(harness, remove) {
  if (harness === 'claude') {
    installArrayHook(path.join(os.homedir(), '.claude', 'settings.json'), {}, 'PostToolUse', {
      matcher: 'Skill', hooks: [{ type: 'command', command: command(harness) }],
    }, remove);
  } else if (harness === 'codex') {
    installArrayHook(path.join(os.homedir(), '.codex', 'hooks.json'), { description: 'User-level Codex hooks.' }, 'PostToolUse', {
      matcher: 'Bash|functions\\.exec|shell_command|read_mcp_resource|read_file|view_file',
      hooks: [{ type: 'command', command: command(harness), timeout: 5 }],
    }, remove);
  } else if (harness === 'cursor') {
    installArrayHook(path.join(os.homedir(), '.cursor', 'hooks.json'), { version: 1 }, 'postToolUse', {
      matcher: 'Read', command: command(harness), timeout: 5,
    }, remove);
  } else if (harness === 'antigravity') {
    const file = path.join(os.homedir(), '.gemini', 'config', 'hooks.json');
    const config = loadConfig(file, {});
    delete config[MARKER];
    if (!remove) {
      config[MARKER] = {
        PostInvocation: [{ type: 'command', command: command(harness), timeout: 5 }],
      };
    }
    saveConfig(file, config);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const selected = args.harness === 'all' ? HARNESSES : [args.harness];
  if (!args.remove) {
    fs.mkdirSync(ADAPTER_DIR, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'scripts', 'log-skill-invocation.mjs'), ADAPTER);
    fs.copyFileSync(path.join(ROOT, 'registry.json'), path.join(ADAPTER_DIR, 'registry.json'));
  }
  for (const harness of selected) configure(harness, args.remove);
  console.log(`${args.remove ? 'Removed' : 'Installed'} telemetry hooks: ${selected.join(', ')}`);
  if (!args.remove && selected.includes('codex')) {
    console.log('Codex requires reviewing this command hook once in /hooks before it will run.');
  }
}

try { main(); } catch (error) {
  console.error(error.message);
  process.exit(1);
}
