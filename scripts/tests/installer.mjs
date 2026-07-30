import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 9. Installer: array-valued harnessPaths (codex installs to two dirs) ----------
// codex is the one harness with a multi-path entry (registry.json's
// _harnessPathsNote explains why) — this proves install.mjs actually
// expands it to multiple targets rather than silently installing to only
// the first, which no other test here would catch (every other harness is
// a single string and wouldn't exercise the Array.isArray branch at all).
{
  const fakeHome = fs.mkdtempSync(path.join(tmpBase, 'installer-fakehome-'));
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'install.mjs'), '--harness', 'codex', '--skill', 'mental-models'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome } });
  expect('install.mjs --harness codex: exits 0', r.status === 0, r.stderr || r.stdout);
  expect('install.mjs --harness codex: installs to ~/.codex/skills',
    fs.existsSync(path.join(fakeHome, '.codex', 'skills', 'mental-models', 'SKILL.md')));
  expect('install.mjs --harness codex: installs to ~/.agents/skills',
    fs.existsSync(path.join(fakeHome, '.agents', 'skills', 'mental-models', 'SKILL.md')));
  expect('install.mjs --harness codex: reports 2 target(s)', /2 target\(s\)/.test(r.stdout), r.stdout);
}

// ---------- 9b. INSTALLED skills must actually run ----------
// Every other test in this file runs checkers from the DEV CHECKOUT, where
// core.lib resolves to core/lib and sibling files under core/ are reachable.
// An installed skill resolves core.lib to scripts/vendor/lib instead, so
// anything under core/ that install.mjs forgets to vendor is missing at
// runtime — and no dev-checkout test can ever see it.
//
// This gap shipped a real bug: core/gitleaks-extra.toml was not vendored, so
// EVERY installed check-backend run failed with "unable to load gitleaks
// config" — an unconditional BLOCK on every project, while this suite stayed
// green. Asserting a specific missing file would only re-pin that one bug, so
// the check below is deliberately generic: install, then run, and require the
// checker to reach a real verdict.
{
  const dest = fs.mkdtempSync(path.join(tmpBase, 'installed-'));
  const inst = spawnSync(process.execPath,
    [path.join(root, 'scripts', 'install.mjs'), '--dest', dest, '--skill', 'backend-engineering'],
    { cwd: root, encoding: 'utf8' });
  expect('install.mjs --dest: exits 0', inst.status === 0, inst.stderr || inst.stdout);

  // Every regular file directly under core/ must reach the vendored core.
  // Directory-by-directory vendoring is what silently dropped gitleaks-extra.toml.
  const vendor = path.join(dest, 'backend-engineering', 'scripts', 'vendor');
  for (const entry of fs.readdirSync(path.join(root, 'core'), { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    expect(`install.mjs vendors core/${entry.name}`, fs.existsSync(path.join(vendor, entry.name)));
  }

  // Run the INSTALLED checker against a clean, minimal server project.
  const proj = fs.mkdtempSync(path.join(tmpBase, 'installed-proj-'));
  fs.writeFileSync(path.join(proj, 'package.json'), '{"dependencies":{"express":"^4.0.0"}}\n');
  fs.writeFileSync(path.join(proj, 'server.js'), 'module.exports = {};\n');
  const run = spawnSync(process.execPath,
    [path.join(dest, 'backend-engineering', 'scripts', 'check-backend.js'), '--root', proj, '--no-write'],
    { encoding: 'utf8' });
  let installedReport = null;
  try { installedReport = JSON.parse(run.stdout); } catch { /* asserted below */ }
  expect('installed check-backend: emits a parseable report', installedReport !== null,
    (run.stderr || run.stdout || '').slice(0, 300));
  if (installedReport) {
    const secrets = installedReport.checks.find((c) => c.id === 'B-client-secrets');
    // The tool itself may legitimately be absent locally (=> not_evaluated).
    // What must never happen is the checker failing because its OWN install
    // is incomplete — that's a broken product, not a finding about the project.
    expect('installed check-backend: does not fail on its own missing config',
      Boolean(secrets) && !/did not complete normally|unable to load/i.test(secrets.detail),
      secrets ? secrets.detail.slice(0, 200) : 'B-client-secrets check absent');
    expect('installed check-backend: clean project is not BLOCKed',
      installedReport.verdict !== 'BLOCK', JSON.stringify(installedReport.checks));
  }
}

// ---------- 13c. The installer must refuse to clobber what it didn't create ----------
// The marker-ownership guard could be replaced with `if (false)` — deleting any
// directory in its path — and no test noticed.
{
  const dest = fs.mkdtempSync(path.join(tmpBase, 'clobber-'));
  const victim = path.join(dest, 'mental-models');
  fs.mkdirSync(victim, { recursive: true });
  fs.writeFileSync(path.join(victim, 'PRECIOUS.txt'), 'not installer-created\n');
  const r = spawnSync(process.execPath,
    [path.join(root, 'scripts', 'install.mjs'), '--dest', dest, '--skill', 'mental-models'],
    { cwd: root, encoding: 'utf8' });
  expect('installer: refuses a directory it did not create', r.status !== 0, `exit ${r.status}`);
  expect('installer: leaves the pre-existing file intact', fs.existsSync(path.join(victim, 'PRECIOUS.txt')));
  const forced = spawnSync(process.execPath,
    [path.join(root, 'scripts', 'install.mjs'), '--dest', dest, '--skill', 'mental-models', '--force'],
    { cwd: root, encoding: 'utf8' });
  expect('installer: --force does replace it', forced.status === 0 && fs.existsSync(path.join(victim, 'SKILL.md')),
    forced.stderr || forced.stdout);
}
