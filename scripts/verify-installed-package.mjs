#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(repoRoot, 'registry.json'), 'utf8'));
const searchIndex = process.argv.indexOf('--search-root');
const searchRoot = searchIndex >= 0 ? path.resolve(process.argv[searchIndex + 1] || '') : null;

if (!searchRoot || !fs.existsSync(searchRoot)) {
  console.error('Usage: node scripts/verify-installed-package.mjs --search-root <existing-directory>');
  process.exit(2);
}

function findCandidates(dir, depth = 0) {
  if (depth > 7) return [];
  const skills = path.join(dir, 'skills');
  if (fs.existsSync(skills) && registry.skills.every(({ id }) =>
    fs.existsSync(path.join(skills, id, 'SKILL.md')))) return [dir];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => findCandidates(path.join(dir, entry.name), depth + 1));
}

const candidates = findCandidates(searchRoot);
if (candidates.length !== 1) {
  console.error(`Expected exactly one installed agent-skills package under ${searchRoot}; found ${candidates.length}: ${candidates.join(', ')}`);
  process.exit(1);
}

const packageRoot = candidates[0];
const checker = path.join(packageRoot, 'skills', 'release-engineering', 'scripts', 'check-smoke.js');
const run = spawnSync(process.execPath, [checker, '--root', path.join(repoRoot, 'fixtures', 'smoke-ship'), '--no-write'], {
  encoding: 'utf8',
});
let report = null;
try { report = JSON.parse(run.stdout); } catch {}
if (run.error || run.status !== 0 || report?.skill !== 'release-engineering' || report?.verdict !== 'SHIP') {
  console.error(`Installed checker did not execute from ${packageRoot}.\n${run.stdout}${run.stderr}`);
  process.exit(1);
}

console.log(`Verified ${registry.skills.length} installed skills and checker runtime at ${packageRoot}.`);
