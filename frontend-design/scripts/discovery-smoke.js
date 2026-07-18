#!/usr/bin/env node
/**
 * Deterministic smoke for discovery-first skill behavior.
 *
 * Usage:
 *   node discovery-smoke.js [--skill-root path]
 *
 * Exit 0 when all checks pass; exit 1 otherwise.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { findSkillRoot } = require('./lib-skill-root.cjs');

function runNode(script, args, cwd) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    shell: false,
  });
  return {
    code: r.status ?? 1,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function assert(name, ok, detail) {
  if (ok) {
    console.log(`  PASS  ${name}`);
    return true;
  }
  console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  return false;
}

function main() {
  const skillRoot = findSkillRoot(
    process.argv.includes('--skill-root')
      ? process.argv[process.argv.indexOf('--skill-root') + 1]
      : undefined,
  );
  if (!skillRoot) {
    console.error('Cannot find skill root.');
    process.exit(1);
  }

  const profileScript = path.join(skillRoot, 'scripts', 'profile-project.js');
  const guardScript = path.join(skillRoot, 'scripts', 'init-ui-guardrails.js');
  const referenceRoot = path.join(skillRoot, 'ab-harness', 'reference-with-skill');

  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-discovery-empty-'));
  let passed = 0;
  let failed = 0;

  console.log('\ndiscovery-smoke\n');

  // 1. Empty greenfield → openQuestions required
  {
    const outPath = path.join(emptyRoot, 'design-profile.json');
    const r = runNode(profileScript, ['--root', emptyRoot, '--out', outPath], emptyRoot);
    let profile = null;
    try {
      profile = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    } catch {
      /* handled below */
    }
    const checks = [
      assert('empty dir exits 0', r.code === 0, r.stderr),
      assert('empty dir scope = component', profile?.scopeTier === 'component'),
      assert('empty dir has openQuestions', (profile?.openQuestions?.length ?? 0) >= 2),
      assert('guidance mentions discovery', profile?.guidance?.some((g) => /discovery/i.test(g))),
    ];
    passed += checks.filter(Boolean).length;
    failed += checks.length - checks.filter(Boolean).length;
  }

  // 2. Reference app with direction → no openQuestions
  if (fs.existsSync(referenceRoot)) {
    const outPath = path.join(referenceRoot, 'design-profile.json');
    const r = runNode(profileScript, ['--root', referenceRoot, '--out', outPath], referenceRoot);
    let profile = null;
    try {
      profile = JSON.parse(fs.readFileSync(outPath, 'utf8'));
    } catch {
      /* handled below */
    }
    const checks = [
      assert('reference exits 0', r.code === 0, r.stderr),
      assert('reference scope = app', profile?.scopeTier === 'app'),
      assert('reference has design-direction', profile?.hasDesignDirection === true),
      assert('reference openQuestions empty', (profile?.openQuestions?.length ?? -1) === 0),
    ];
    passed += checks.filter(Boolean).length;
    failed += checks.length - checks.filter(Boolean).length;
  } else {
    console.log('  SKIP  reference-with-skill (path missing)');
  }

  // 3. init-ui-guardrails requires explicit --shell
  {
    const guardRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fd-discovery-guard-'));
    const r = runNode(
      guardScript,
      ['--root', guardRoot, '--skill-root', skillRoot],
      guardRoot,
    );
    const checks = [
      assert('guardrails without --shell fails', r.code !== 0),
      assert('guardrails error mentions discovery', /discovery/i.test(r.stderr)),
    ];
    passed += checks.filter(Boolean).length;
    failed += checks.length - checks.filter(Boolean).length;
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
