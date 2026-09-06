// A skill staged the way the eval stages it must be able to run its own
// checker inside a fixture that declares "type": "module".
//
// It could not, for the life of the programme. accept-check.js is CommonJS;
// staged bare into .agent-input/ under a fixture package.json saying
// "type": "module", Node resolved it as ESM and refused require('fs') on
// line 23. With that patched it failed again: the eval staged the root skill
// directory, which has no vendored core, so resolve-core threw "agent-skills
// core not found". 38 of 44 measured fixtures are ESM. The arm told to run
// the gate was the one arm whose gate could not run, on every harness.
//
// This test does what a skill-arm run does — stage, then invoke the checker
// from inside the fixture — and fails on the tree as it stood.
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { stageSkill, stagedSkillsDigest } from '../lib/stage-skill.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'staged-checker-'));

// An ESM fixture, the common case.
fs.writeFileSync(path.join(work, 'package.json'), JSON.stringify({ name: 'fx', type: 'module', scripts: { test: 'node --test' } }));
fs.writeFileSync(path.join(work, 'PRODUCT.md'), '# P\n\n## Purpose\nx\n## Users\nx\n## Success\nx\n## MVP\nx\n## Constraints\nx\n');

const staged = stageSkill(root, 'product-acceptance', path.join(work, '.agent-input', 'product-acceptance'));
assert.ok(fs.existsSync(path.join(staged, 'package.json')), 'a staged skill with scripts declares its module system');
assert.strictEqual(JSON.parse(fs.readFileSync(path.join(staged, 'package.json'), 'utf8')).type, 'commonjs');
assert.ok(fs.existsSync(path.join(staged, 'scripts', 'vendor', 'registry.json')), 'the core is vendored beside the scripts');

// The invocation the skill text tells the model to make, from the fixture root.
const r = spawnSync(process.execPath,
  ['.agent-input/product-acceptance/scripts/accept-check.js', '--root', '.', '--acceptor-context', 'separate'],
  { cwd: work, encoding: 'utf8' });
assert.ok(!/require is not defined|ERR_REQUIRE_ESM|core not found/.test(r.stderr),
  `the staged checker must run inside an ESM fixture:\n${r.stderr.slice(0, 400)}`);
let report;
try { report = JSON.parse(r.stdout); } catch { assert.fail(`checker emitted no JSON:\n${(r.stderr || r.stdout).slice(0, 400)}`); }
assert.ok(['SHIP', 'CONDITIONAL', 'BLOCK'].includes(report.verdict), `a verdict was produced: ${report.verdict}`);

// A skill with CommonJS scripts that do NOT import the core still needs the
// declaration — three of the nine script-bearing skills are like this — and
// must not get a pointless vendor directory.
const noCore = stageSkill(root, 'ai-prose-slop', path.join(work, '.agent-input', 'ai-prose-slop'));
assert.ok(fs.existsSync(path.join(noCore, 'package.json')), 'CommonJS scripts without a core import are still declared');
assert.ok(!fs.existsSync(path.join(noCore, 'scripts', 'vendor')), 'no core import, no vendored core');

// A prose-only skill gets neither a vendor nor a declaration.
const prose = stageSkill(root, 'mental-models', path.join(work, '.agent-input', 'mental-models'));
assert.ok(!fs.existsSync(path.join(prose, 'package.json')));
assert.ok(!fs.existsSync(path.join(prose, 'scripts', 'vendor')));

// The currency digest is the digest of what staging produces — the two are
// the same operation, so a run's stagedInputSha256 and the report's idea of
// "current" cannot disagree about what a version is.
const digest = stagedSkillsDigest(root, ['product-acceptance']);
assert.match(digest, /^[0-9a-f]{64}$/);
assert.strictEqual(stagedSkillsDigest(root, ['product-acceptance']), digest, 'the digest is deterministic');

fs.rmSync(work, { recursive: true, force: true });
console.log('eval-staged-checker-runs: a staged skill can run its own checker inside an ESM fixture');
