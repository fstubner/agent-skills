import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 10. A --root that cannot be read is never a pass ----------
// Every checker's file walk swallows readdirSync errors, so a nonexistent or
// unreadable --root produced "zero files found" -> "not applicable" -> pass ->
// SHIP, exit 0, on all six checkers. A typo'd path in CI was indistinguishable
// from a clean codebase — the precise failure the suite's own contract
// ("missing evidence can never read as success") exists to forbid.
//
// This is NOT the same as "scanned fine, found no server" — that remains a
// legitimate pass. The distinction under test is readable-but-empty vs.
// unreadable.
{
  const missing = path.join(tmpBase, 'no-such-project-dir');
  const CHECKERS = [
    ['systems-architecture', ARCH],
    ['frontend', FRONTEND],
    ['backend-engineering', BACKEND],
    ['product-acceptance', ACCEPT],
    ['code-organization', 'code-organization/scripts/check-organization.js'],
    ['code-smells', 'code-smells/scripts/check-smells.js'],
    ['data-modeling', 'data-modeling/scripts/check-migrations.js'],
  ];
  for (const [name, script] of CHECKERS) {
    const r = runNode(path.join(root, ...script.split('/')), ['--root', missing, '--no-write']);
    let rep = null;
    try { rep = JSON.parse(r.stdout); } catch { /* a hard exit with no JSON is also acceptable */ }
    expect(`${name}: unreadable --root does not exit 0`, r.status !== 0, `exit ${r.status}: ${r.stdout.slice(0, 160)}`);
    expect(`${name}: unreadable --root does not report SHIP`,
      rep === null || rep.verdict !== 'SHIP', JSON.stringify(rep && rep.checks));
  }

  // A readable directory with no signals must still be a legitimate pass —
  // proving the fix above discriminates rather than just blanket-failing.
  const emptyProj = fs.mkdtempSync(path.join(tmpBase, 'genuinely-empty-'));
  fs.writeFileSync(path.join(emptyProj, 'notes.txt'), 'no code here\n');
  const okRun = runNode(path.join(root, ...BACKEND.split('/')), ['--root', emptyProj, '--no-write']);
  expect('backend-engineering: readable-but-empty project is still a clean pass',
    okRun.status === 0, `exit ${okRun.status}: ${okRun.stdout.slice(0, 200)}`);
}

// ---------- 10c. core/gitleaks-extra.toml must not fire on documentation ----------
// The two supplementary rules (Anthropic / OpenAI project keys, which gitleaks'
// default ruleset does not cover as of 8.30.1) were bare prefix regexes with no
// entropy floor and no allowlist. Result: any repo whose docs SHOW the key
// format — "keys look like sk-ant-api03-YOUR-KEY-HERE" — was BLOCKed, while
// upstream gitleaks correctly ignored the same line. That's a false positive on
// exactly the projects this suite targets (LLM tooling), and a gate that cries
// wolf is a gate people disable.
//
// The realistic key is generated at RUNTIME, never stored as a literal: a
// high-entropy sk-ant- string committed to this repo would trip the suite's own
// pre-commit hook.
{
  const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  gitleaks-extra.toml precision tests: gitleaks not installed');
  } else {
    const crypto = await import('node:crypto');
    const entropicTail = crypto.randomBytes(72).toString('base64url').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 95);
    const proj = fs.mkdtempSync(path.join(tmpBase, 'gitleaks-precision-'));
    fs.writeFileSync(path.join(proj, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
    fs.writeFileSync(path.join(proj, 'server.js'), 'module.exports = {};\n');
    // TRUE POSITIVE: a realistic, high-entropy key.
    fs.writeFileSync(path.join(proj, 'leak.js'), `const k = "${'sk-ant-' + 'api03-' + entropicTail}";\n`);
    const leakRun = runNode(path.join(root, ...BACKEND.split('/')), ['--root', proj, '--no-write']);
    let leakRep = null;
    try { leakRep = JSON.parse(leakRun.stdout); } catch { /* asserted below */ }
    expect('gitleaks-extra: a realistic Anthropic key is still caught',
      leakRep && leakRep.checks.find((c) => c.id === 'B-client-secrets')?.status === 'fail',
      JSON.stringify(leakRep && leakRep.checks));

    // FALSE POSITIVE GUARD: docs describing the format, and a benign URL slug
    // sharing the prefix. Neither is a credential.
    fs.rmSync(path.join(proj, 'leak.js'));
    fs.writeFileSync(path.join(proj, 'README.md'),
      '# Setup\n\nSet ANTHROPIC_API_KEY. Keys look like sk-ant-api03-YOUR-KEY-HERE.\n');
    fs.writeFileSync(path.join(proj, 'cdn.js'),
      'const u = "https://cdn.acme.io/assets/sk-ant-theme-bundle-v2";\n');
    fs.writeFileSync(path.join(proj, 'ci.sh'), 'KEY=sk-proj-CI_PLACEHOLDER_TOKEN_1234\n');
    const cleanRun = runNode(path.join(root, ...BACKEND.split('/')), ['--root', proj, '--no-write']);
    let cleanRep = null;
    try { cleanRep = JSON.parse(cleanRun.stdout); } catch { /* asserted below */ }
    const cleanSecrets = cleanRep && cleanRep.checks.find((c) => c.id === 'B-client-secrets');
    expect('gitleaks-extra: documentation placeholders do not BLOCK',
      Boolean(cleanSecrets) && cleanSecrets.status === 'pass',
      cleanSecrets ? cleanSecrets.detail.slice(0, 220) : JSON.stringify(cleanRep));
  }
}

// ---------- 10d. Acceptance must not trust a producer's self-declared verdict ----------
// accept-check re-runs producers rather than reading their JSON off disk — but
// it then branched on report.verdict, a value the producer wrote about itself.
// That reintroduces the trust the design exists to remove, one level down: a
// producer emitting {verdict:'SHIP', checks:[{status:'fail'}]} was recorded as
// a passing producer with the failing check in hand.
//
// Built as a minimal temp suite (core + registry + product-acceptance + one
// stub producer) so a lying producer can be exercised without touching the repo.
{
  const suite = fs.mkdtempSync(path.join(tmpBase, 'lying-producer-suite-'));
  fs.cpSync(path.join(root, 'core'), path.join(suite, 'core'), { recursive: true });
  fs.copyFileSync(path.join(root, 'registry.json'), path.join(suite, 'registry.json'));
  fs.cpSync(path.join(root, 'product-acceptance'), path.join(suite, 'product-acceptance'), { recursive: true });

  // Stub frontend producer: claims SHIP while reporting a failing check.
  const stubDir = path.join(suite, 'frontend', 'scripts');
  fs.mkdirSync(stubDir, { recursive: true });
  fs.writeFileSync(path.join(stubDir, 'check-frontend.js'),
    'console.log(JSON.stringify({schemaVersion:1,skill:"frontend",generatedAt:"2026-01-01T00:00:00Z",' +
    'root:"/",verdict:"SHIP",checks:[{id:"F-boom",status:"fail",detail:"deliberate disagreement"}]}));\n');

  const proj = fs.mkdtempSync(path.join(tmpBase, 'lying-producer-proj-'));
  fs.mkdirSync(path.join(proj, 'public'), { recursive: true });
  fs.writeFileSync(path.join(proj, 'public', 'index.html'), '<!doctype html><html></html>\n');
  fs.writeFileSync(path.join(proj, 'PRODUCT.md'),
    '# P\n\n## Purpose\nx\n\n## Users\nx\n\n## Success\nx\n\n## MVP\nx\n\n## Constraints\nx\n');

  const r = runNode(path.join(suite, 'product-acceptance', 'scripts', 'accept-check.js'),
    ['--root', proj, '--no-write', '--acceptor-context', 'separate']);
  let rep = null;
  try { rep = JSON.parse(r.stdout); } catch { /* asserted below */ }
  const dFrontend = rep && rep.checks.find((c) => c.id === 'D-frontend');
  expect('acceptance: a producer claiming SHIP with a failing check is not recorded as pass',
    Boolean(dFrontend) && dFrontend.status !== 'pass',
    dFrontend ? `${dFrontend.status}: ${dFrontend.detail}` : JSON.stringify(rep && rep.checks));
  expect('acceptance: overall verdict is not SHIP when a producer lied',
    rep && rep.verdict !== 'SHIP', rep && rep.verdict);
}

// ---------- 10e. The audited repo must not be able to disable its own scan ----------
// product-acceptance is the skill most likely to run standalone against an
// untrusted finished repo, and accept-check.js's header promises a planted file
// "can never satisfy this gate". That held for report JSON but not for the
// SCANNER'S OWN CONFIG: gitleaks auto-discovers <source>/.gitleaks.toml, and
// honors inline `gitleaks:allow` comments. Both live inside the audited tree,
// so the repo could switch off its own secret scan.
{
  const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  planted-gitleaks-config tests: gitleaks not installed');
  } else {
    const mkProj = (extra) => {
      const p = fs.mkdtempSync(path.join(tmpBase, 'hostile-repo-'));
      fs.mkdirSync(path.join(p, 'src'), { recursive: true });
      fs.writeFileSync(path.join(p, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
      fs.writeFileSync(path.join(p, 'server.js'), 'module.exports = {};\n');
      fs.writeFileSync(path.join(p, 'src', 'config.js'),
        `const t = "${'ghp_' + '1234567890abcdefghij1234567890ABCDEF'}";${extra.inlineAllow ? ' //gitleaks:allow' : ''}\n`);
      if (extra.plantedConfig) fs.writeFileSync(path.join(p, '.gitleaks.toml'), '[allowlist]\npaths = [".*"]\n');
      if (extra.plantedIgnore) fs.writeFileSync(path.join(p, '.gitleaksignore'), 'src/config.js:github-pat:1\n');
      return p;
    };
    const statusFor = (p) => {
      const r = runNode(path.join(root, ...BACKEND.split('/')), ['--root', p, '--no-write']);
      try { return JSON.parse(r.stdout).checks.find((c) => c.id === 'B-client-secrets')?.status; }
      catch { return `unparseable: ${r.stdout.slice(0, 120)}`; }
    };
    expect('acceptance: baseline leak is caught', statusFor(mkProj({})) === 'fail');
    expect('acceptance: a planted .gitleaks.toml cannot disable the scan',
      statusFor(mkProj({ plantedConfig: true })) === 'fail');
    expect('acceptance: an inline gitleaks:allow comment cannot disable the scan',
      statusFor(mkProj({ inlineAllow: true })) === 'fail');
    expect('acceptance: a planted .gitleaksignore cannot disable the scan',
      statusFor(mkProj({ plantedIgnore: true })) === 'fail');
  }
}
