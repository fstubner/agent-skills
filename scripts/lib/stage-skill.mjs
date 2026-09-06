// How a skill directory is turned into the thing that actually ships.
//
// A skill in this repository is not runnable as it sits. Its scripts import
// the suite's shared core through scripts/resolve-core.cjs, which finds that
// core either at the suite checkout or vendored beside the script; and the
// scripts are CommonJS, which Node will refuse to load as soon as the nearest
// package.json above them says "type": "module".
//
// Three things used to copy skills, each with its own idea of what that
// meant. The installer vendored core and wrote a marker. The plugin-bundle
// generator vendored core. The eval harness copied the bare directory and
// vendored nothing. That last one is how the eval spent a month measuring a
// skill arm whose mandated checker could not execute: staged into a fixture
// declaring "type": "module", accept-check.js failed on require('fs'), and
// with that patched it failed again on "agent-skills core not found". The arm
// told to run the gate was the one arm whose gate was broken — on every
// harness. Written up in eval/results/antigravity-product-acceptance-2026-09-06.md.
//
// Nobody had written the package.json at all. 38 of the 44 measured fixtures
// declare "type": "module", and so do most real projects now; the registry
// documents Antigravity IDE reading skills from <workspace-root>/.agents/skills,
// inside the project, where the same failure waits for every user.
//
// So: one function, used by all three. What it produces is by definition
// what ships, and the eval's skill-currency digest is computed by staging
// into a scratch directory and hashing that — so the digest and the staged
// tree cannot disagree about what a "version" of the skill is.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { hashTree } from './tree-hash.mjs';

// Two separate questions, because they have different answers. Any skill
// whose scripts/ holds a .js file is CommonJS and needs the module
// declaration; only one that imports the shared core through
// resolve-core.cjs needs the core vendored beside it. Keying both on
// resolve-core.cjs — the first draft — left ai-prose-slop, code-organization
// and data-modeling undeclared: three skills with require() in their scripts
// and nothing to pin the module system.
function hasCjsScripts(skillDir) {
  const scripts = path.join(skillDir, 'scripts');
  return fs.existsSync(scripts) && fs.readdirSync(scripts).some((f) => f.endsWith('.js'));
}
function importsCore(skillDir) {
  return fs.existsSync(path.join(skillDir, 'scripts', 'resolve-core.cjs'));
}

// Copy a tree, skipping what never belongs in a shipped skill.
export function copyTree(src, dest, exclude = new Set(['node_modules', '.git'])) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (exclude.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to, exclude);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

// The ENTIRE core, as a directory copy. The installer once enumerated `lib`
// and `schemas` and silently dropped core/gitleaks-extra.toml, so every
// installed check-backend failed with "unable to load gitleaks config" —
// invisible to every dev-checkout test because there the core was reachable
// as a sibling. A new file under core/ ships by default now.
export function vendorCore(suiteRoot, skillDestination) {
  const vendor = path.join(skillDestination, 'scripts', 'vendor');
  copyTree(path.join(suiteRoot, 'core'), vendor);
  fs.copyFileSync(path.join(suiteRoot, 'registry.json'), path.join(vendor, 'registry.json'));
}

// Pin the module system for everything under the skill directory, so a host
// project's "type": "module" cannot reach it. Node resolves the NEAREST
// package.json above a script, and this one is nearer than the project's.
export function declareCommonJs(skillDestination) {
  fs.writeFileSync(path.join(skillDestination, 'package.json'), '{\n  "type": "commonjs"\n}\n');
}

// What a copied skill directory still needs before it is what ships. Called
// by stageSkill, and by the plugin-bundle generator on the copies it makes.
export function finishStagedSkill(suiteRoot, destination) {
  if (importsCore(destination)) vendorCore(suiteRoot, destination);
  if (hasCjsScripts(destination)) declareCommonJs(destination);
  return destination;
}

// Stage one skill, as shipped, into `destination`. `copy` may be supplied by a
// caller that needs different copy semantics (the installer follows symlinks
// and refuses loops); the vendoring and the declaration are not negotiable.
export function stageSkill(suiteRoot, skillId, destination, { copy = copyTree } = {}) {
  copy(path.join(suiteRoot, skillId), destination);
  return finishStagedSkill(suiteRoot, destination);
}

// The digest eval-run records as stagedInputSha256 for a skill arm of these
// skills, computed by doing exactly what eval-run does — staging into a
// scratch .agent-input and hashing it. Correct by construction: there is no
// second description of the staged layout for this to drift from.
export function stagedSkillsDigest(suiteRoot, skillIds) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-skills-'));
  try {
    for (const id of skillIds) stageSkill(suiteRoot, id, path.join(scratch, id));
    return hashTree(scratch);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
