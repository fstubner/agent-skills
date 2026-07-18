#!/usr/bin/env node
// Manifest-driven install into Cursor / Claude / Codex skill dirs.
// Usage:
//   node scripts/install.mjs [--harness cursor|claude|codex|all] [--dest <dir>]
// Defaults: --harness all

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'suite.manifest.json'), 'utf8'));

function parseArgs(argv) {
  const out = { harness: 'all' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--harness') out.harness = argv[++i];
    else if (argv[i] === '--dest') out.dest = argv[++i];
  }
  return out;
}

function expandHome(p) {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'artifacts') continue;
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

const args = parseArgs(process.argv.slice(2));
const targets = [];
if (args.dest) targets.push(args.dest);
else {
  const map = {
    cursor: expandHome(manifest.harnessPaths.cursor),
    claude: expandHome(manifest.harnessPaths.claude),
    codex: expandHome(manifest.harnessPaths.codex),
  };
  if (args.harness === 'all') targets.push(...Object.values(map));
  else if (!map[args.harness]) {
    console.error(`Unknown harness: ${args.harness}`);
    process.exit(1);
  } else targets.push(map[args.harness]);
}

const names = [...manifest.skills, ...(manifest.optional || [])];
for (const destRoot of targets) {
  fs.mkdirSync(destRoot, { recursive: true });
  for (const name of names) {
    const src = path.join(root, name);
    if (!fs.existsSync(src)) {
      console.warn(`skip missing: ${name}`);
      continue;
    }
    const dest = path.join(destRoot, name);
    fs.rmSync(dest, { recursive: true, force: true });
    copyDir(src, dest);
    console.log(`installed ${name} → ${dest}`);
  }
}
console.log('done');
