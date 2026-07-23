#!/usr/bin/env node
// Installer. Safety rules (each one is a lesson from the v0.4 audit):
// - No default target: running with no args prints usage, writes nothing.
// - Never deletes a directory this installer didn't create (marker file),
//   unless --force.
// - Refuses skill ids with path separators; refuses src == dest.
// - Vendors core/lib, core/schemas, and registry.json into each skill's
//   scripts/vendor/ so every installed skill is standalone.
// - No network access, ever.
//
// Usage:
//   node scripts/install.mjs --harness cursor|claude|codex|all
//   node scripts/install.mjs --dest <dir>
//   Options: --force, --help

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'registry.json'), 'utf8'));
const version = fs.readFileSync(path.join(suiteRoot, registry.suiteVersionFile), 'utf8').trim();
const MARKER = '.agent-skills-install.json';

const USAGE = `agent-skills installer v${version}

  node scripts/install.mjs --harness cursor|claude|codex|all
  node scripts/install.mjs --dest <directory>

Options:
  --force   replace existing skill directories even without an installer marker
  --help    show this help

Refuses to touch directories it didn't create (marker: ${MARKER}) unless --force.
Claude Desktop (cloud) has no filesystem target — upload skills via the UI; see INSTALL.md.`;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--force') out.force = true;
    else if (a === '--harness') out.harness = argv[++i];
    else if (a === '--dest') out.dest = argv[++i];
    else {
      console.error(`Unknown argument: ${a}\n\n${USAGE}`);
      process.exit(1);
    }
  }
  return out;
}

function expandHome(p) {
  // Only expand a leading "~" that means home (bare "~", or "~/..."/"~\...").
  // A plain startsWith('~') check also matches "~backup" and would rewrite
  // it into "<home>backup" — a real directory a user might legitimately name.
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(USAGE);
  process.exit(0);
}

let targets = [];
if (args.dest) {
  targets = [path.resolve(args.dest)];
} else if (args.harness) {
  const known = Object.keys(registry.harnessPaths);
  const picked = args.harness === 'all' ? known : [args.harness];
  for (const h of picked) {
    if (!known.includes(h)) {
      console.error(`Unknown harness "${h}". Known: ${known.join(', ')}, all\n\n${USAGE}`);
      process.exit(1);
    }
    targets.push(expandHome(registry.harnessPaths[h]));
  }
} else {
  console.error(USAGE);
  process.exit(1);
}

let failures = 0;
for (const target of targets) {
  for (const skill of registry.skills) {
    const id = skill.id;
    if (!/^[a-z][a-z0-9-]*$/.test(id)) {
      console.error(`SKIP  invalid skill id in registry: ${JSON.stringify(id)}`);
      failures++;
      continue;
    }
    const src = path.join(suiteRoot, id);
    const dest = path.join(target, id);
    if (path.resolve(src) === path.resolve(dest)) {
      console.error(`SKIP  ${dest} — source and destination are the same directory`);
      failures++;
      continue;
    }
    if (fs.existsSync(dest)) {
      const hasMarker = fs.existsSync(path.join(dest, MARKER));
      if (!hasMarker && !args.force) {
        console.error(`SKIP  ${dest} exists and was not created by this installer — rerun with --force to replace it`);
        failures++;
        continue;
      }
      fs.rmSync(dest, { recursive: true, force: true });
    }
    copyDir(src, dest);
    // Vendor the core so the skill works standalone.
    const vendor = path.join(dest, 'scripts', 'vendor');
    copyDir(path.join(suiteRoot, 'core', 'lib'), path.join(vendor, 'lib'));
    copyDir(path.join(suiteRoot, 'core', 'schemas'), path.join(vendor, 'schemas'));
    fs.copyFileSync(path.join(suiteRoot, 'registry.json'), path.join(vendor, 'registry.json'));
    fs.writeFileSync(path.join(dest, MARKER), JSON.stringify({
      suite: registry.name, version, installedAt: new Date().toISOString(),
    }, null, 2) + '\n');
    console.log(`ok    ${dest}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} skill(s) skipped. Nothing outside the listed paths was touched.`);
  process.exit(1);
}
console.log(`\nInstalled ${registry.skills.length} skill(s) to ${targets.length} target(s).`);
