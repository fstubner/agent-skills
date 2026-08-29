#!/usr/bin/env node
// Installer. Safety rules (each one is a lesson from the v0.4 audit):
// - No default target: running with no args prints usage, writes nothing.
// - Never deletes a directory this installer didn't create (marker file),
//   unless --force.
// - Refuses skill ids with path separators; refuses src == dest.
// - Vendors core/lib, core/schemas, and registry.json into each skill's
//   scripts/vendor/ so every installed skill is standalone.
// - Shells out to `git` once, read-only, to stamp the source commit into the
//   install marker. Absent git, or a source that is not a checkout, drops the
//   fields rather than failing.
// - No network access, ever.
//
// Usage:
//   node scripts/install.mjs --harness cursor|claude|codex|antigravity|all
//   node scripts/install.mjs --dest <dir>
//   Options: --force, --help, --skill <id>[,<id>...] (default: all skills —
//     this is a composable set, not a suite, so any subset is a valid install)
//
// A registry.harnessPaths entry may be a single path or an array of paths.
// legacyHarnessPaths contains former targets whose marker-bearing installs
// can be removed after a successful migration; foreign directories are never
// touched.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const suiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(suiteRoot, 'registry.json'), 'utf8'));
const version = fs.readFileSync(path.join(suiteRoot, registry.suiteVersionFile), 'utf8').trim();
const MARKER = '.agent-skills-install.json';

const allIds = registry.skills.map((s) => s.id);

// What tree did this install come from?
//
// `version` is read from VERSION, which does not move per commit — 29 commits
// on main stamp 1.0.0-alpha.22, so the marker could not distinguish a fresh
// install from a stale one. Recording the commit makes the marker answer the
// question INSTALL.md's Pinning section says it answers.
//
// Silence beats a confident wrong answer here, so the fields are dropped in
// three cases rather than guessed: git is missing, the source has no history,
// or the source is not itself the repository root. That last one matters —
// someone vendoring this suite into their own project would otherwise get their
// project's HEAD recorded as the suite's provenance, which reads as
// authoritative and is not.
function gitProvenance(dir) {
  const git = (...a) => {
    const r = spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const toplevel = git('rev-parse', '--show-toplevel');
  if (!toplevel || path.resolve(toplevel) !== path.resolve(dir)) return {};
  const provenance = {};
  const sha = git('rev-parse', 'HEAD');
  const describe = git('describe', '--tags', '--always', '--dirty');
  if (sha) provenance.gitCommitSha = sha;
  if (describe) provenance.gitDescribe = describe;
  return provenance;
}

// Once, not per skill: the source tree does not change mid-run.
const sourceProvenance = gitProvenance(suiteRoot);

const USAGE = `agent-skills installer v${version}

  node scripts/install.mjs --harness cursor|claude|codex|antigravity|all
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
      let ownsDestination = false;
      try {
        const marker = JSON.parse(fs.readFileSync(path.join(dest, MARKER), 'utf8'));
        ownsDestination = marker.suite === registry.name;
      } catch { /* absent, malformed, or foreign markers do not prove ownership */ }
      if (!ownsDestination && !args.force) {
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
        suite: registry.name, version, ...sourceProvenance,
        installedAt: new Date().toISOString(),
      }, null, 2) + '\n');

      const backup = dest + '.previous-' + process.pid;
      fs.rmSync(backup, { recursive: true, force: true });
      if (fs.existsSync(dest)) fs.renameSync(dest, backup);
      try {
        fs.renameSync(staging, dest);
        fs.rmSync(backup, { recursive: true, force: true });
      } catch (swapError) {
        if (fs.existsSync(backup) && !fs.existsSync(dest)) fs.renameSync(backup, dest);
        throw swapError;
      }
    } catch (e) {
      fs.rmSync(staging, { recursive: true, force: true });
      console.error(`FAIL  ${dest} — ${e.message} (previous install left untouched)`);
      failures++;
      continue;
    }
    console.log(`ok    ${dest}`);
  }
}

// Migrate installer-owned copies away from obsolete harness paths only after
// every requested current-target install succeeds. This is intentionally
// per-skill: unrelated user content under the legacy root is left untouched.
if (failures === 0 && args.harness) {
  const picked = args.harness === 'all' ? Object.keys(registry.harnessPaths) : [args.harness];
  for (const harness of picked) {
    for (const legacyPath of registry.legacyHarnessPaths?.[harness] ?? []) {
      const legacyRoot = expandHome(legacyPath);
      for (const skill of selectedSkills) {
        const legacyDest = path.join(legacyRoot, skill.id);
        let ownsDestination = false;
        try {
          const marker = JSON.parse(fs.readFileSync(path.join(legacyDest, MARKER), 'utf8'));
          ownsDestination = marker.suite === registry.name;
        } catch { /* absent, malformed, or foreign installs stay untouched */ }
        if (!ownsDestination) continue;
        fs.rmSync(legacyDest, { recursive: true, force: true });
        console.log(`clean ${legacyDest} (obsolete managed install)`);
      }
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} skill(s) skipped. Nothing outside the listed paths was touched.`);
  process.exit(1);
}
console.log(`\nInstalled ${selectedSkills.length} skill(s) to ${targets.length} target(s).`);
