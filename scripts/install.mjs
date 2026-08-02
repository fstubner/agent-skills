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
//   node scripts/install.mjs --harness cursor|claude|codex|antigravity|all
//   node scripts/install.mjs --dest <dir>
//   Options: --force, --help, --skill <id>[,<id>...] (default: all skills —
//     this is a composable set, not a suite, so any subset is a valid install)
//
// A registry.harnessPaths entry may be a single path or an array of paths —
// codex is an array (see registry.json's _harnessPathsNote): its own skill
// directory convention is genuinely unsettled upstream right now, so this
// installer hedges by writing to every documented candidate rather than
// guessing which one the user's actual Codex surface reads from.

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'registry.json'), 'utf8'));
const version = fs.readFileSync(path.join(suiteRoot, registry.suiteVersionFile), 'utf8').trim();
const MARKER = '.agent-skills-install.json';

const allIds = registry.skills.map((s) => s.id);

const USAGE = `agent-skills installer v${version}

  node scripts/install.mjs --harness cursor|claude|codex|all
  node scripts/install.mjs --dest <directory>

Options:
  --skill <id>[,<id>...]   install only these skills (default: all)
  --force                  replace existing skill directories even without an installer marker
  --help                   show this help

Known skills: ${allIds.join(', ')}
This is a composable set, not a suite — installing one skill is a normal,
fully-supported install, not a partial one.

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
    else if (a === '--skill') out.skill = argv[++i];
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

// Symlinks are RESOLVED, not preserved and not skipped.
//
// A Dirent from readdirSync({withFileTypes:true}) describes the link itself,
// so isDirectory() and isFile() are BOTH false for one — the previous version
// silently dropped any symlinked file or directory from the install, with no
// warning and a skill that looked fine until the missing file was needed.
//
// Resolving rather than preserving is deliberate: an installed skill has to
// stand alone in ~/.claude/skills, and a link back into the source checkout
// breaks the moment that checkout moves or is deleted.
//
// `seen` carries realpaths so a symlink loop terminates instead of recursing
// until the process dies.
function copyDir(src, dest, seen = new Set()) {
  const realSrc = fs.realpathSync(src);
  if (seen.has(realSrc)) {
    console.error(`WARN  symlink loop at ${src} — not following it again`);
    return;
  }
  seen.add(realSrc);

  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);

    let stat;
    try {
      stat = fs.statSync(s); // follows the link; throws on a broken one
    } catch {
      console.error(`WARN  skipping ${s} — unreadable or a broken symlink`);
      continue;
    }
    if (stat.isDirectory()) copyDir(s, d, seen);
    else if (stat.isFile()) fs.copyFileSync(s, d);
    else console.error(`WARN  skipping ${s} — not a regular file or directory`);
  }
  seen.delete(realSrc);
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
    const hPaths = registry.harnessPaths[h];
    for (const p of Array.isArray(hPaths) ? hPaths : [hPaths]) {
      targets.push(expandHome(p));
    }
  }
} else {
  console.error(USAGE);
  process.exit(1);
}

let selectedSkills = registry.skills;
if (args.skill) {
  const requested = args.skill.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = requested.filter((id) => !allIds.includes(id));
  if (unknown.length > 0) {
    console.error(`Unknown skill(s): ${unknown.join(', ')}. Known: ${allIds.join(', ')}\n\n${USAGE}`);
    process.exit(1);
  }
  selectedSkills = registry.skills.filter((s) => requested.includes(s.id));
}

let failures = 0;
for (const target of targets) {
  for (const skill of selectedSkills) {
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
    }
    // Build beside the destination and swap it in, rather than deleting the
    // old install and copying over the gap. The old order left a window where
    // a crash — disk full, permissions, a killed terminal — produced a
    // half-populated skill directory with no marker file, which the next run
    // then refuses to touch because it looks hand-made. Staging means the
    // failure mode is "nothing happened", and the previous install survives.
    const staging = dest + '.installing-' + process.pid;
    fs.rmSync(staging, { recursive: true, force: true });
    try {
      copyDir(src, staging);
    // Vendor the ENTIRE core so the skill works standalone. Deliberately a
    // whole-directory copy rather than an enumeration of subdirectories: the
    // previous `lib` + `schemas` list silently dropped core/gitleaks-extra.toml,
    // so every INSTALLED check-backend run failed with "unable to load gitleaks
    // config" — an unconditional BLOCK on every project, invisible to every
    // dev-checkout test because there core.lib resolves to core/lib and the
    // sibling file is reachable. Copying core/ wholesale means a new file under
    // core/ ships by default instead of by remembering to add a line here.
      const vendor = path.join(staging, 'scripts', 'vendor');
      copyDir(path.join(suiteRoot, 'core'), vendor);
      fs.copyFileSync(path.join(suiteRoot, 'registry.json'), path.join(vendor, 'registry.json'));
      // Marker last: its presence is what tells a later run this directory is
      // ours to replace, so it must not exist until everything else does.
      fs.writeFileSync(path.join(staging, MARKER), JSON.stringify({
        suite: registry.name, version, installedAt: new Date().toISOString(),
      }, null, 2) + '\n');

      fs.rmSync(dest, { recursive: true, force: true });
      fs.renameSync(staging, dest);
    } catch (e) {
      fs.rmSync(staging, { recursive: true, force: true });
      console.error(`FAIL  ${dest} — ${e.message} (previous install left untouched)`);
      failures++;
      continue;
    }
    console.log(`ok    ${dest}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} skill(s) skipped. Nothing outside the listed paths was touched.`);
  process.exit(1);
}
console.log(`\nInstalled ${selectedSkills.length} skill(s) to ${targets.length} target(s).`);
