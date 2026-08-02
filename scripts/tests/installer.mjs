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

// ---------- 9c. Installer: symlinks, and failure atomicity ----------
// A Dirent from readdirSync({withFileTypes:true}) describes the LINK, so for
// a symlink both isDirectory() and isFile() are false — verified on Windows
// junctions, where the old branch fell through and dropped the entry with no
// warning. An installed skill missing a reference file looks fine until the
// file is needed. Symlinks are now resolved (an install must stand alone;
// a link back into the source checkout breaks when it moves).
{
  const INSTALL = path.join(root, 'scripts', 'install.mjs');
  const home = fs.mkdtempSync(path.join(tmpBase, 'insthome-'));
  const linkTarget = fs.mkdtempSync(path.join(tmpBase, 'linktarget-'));
  fs.writeFileSync(path.join(linkTarget, 'canary.md'), 'canary content\n');

  const linkPath = path.join(root, 'mental-models', 'references', '_symtest_dir');
  let madeLink = false;
  try {
    fs.symlinkSync(linkTarget, linkPath, 'junction');
    madeLink = true;
  } catch {
    console.log('skip  installer symlink test: cannot create links here');
  }

  if (madeLink) {
    try {
      // Pin the premise: if a future Node reports isDirectory() true for a
      // junction, the old code was fine and this test is guarding nothing.
      const dirent = fs.readdirSync(path.join(root, 'mental-models', 'references'), { withFileTypes: true })
        .find((e) => e.name === '_symtest_dir');
      expect('installer: a link Dirent is neither file nor directory (why the old code dropped it)',
        Boolean(dirent) && !dirent.isDirectory() && !dirent.isFile(),
        dirent ? `isDirectory=${dirent.isDirectory()} isFile=${dirent.isFile()}` : 'entry missing');

      const r = spawnSync(process.execPath, [INSTALL, '--harness', 'claude', '--skill', 'mental-models'], {
        encoding: 'utf8',
        env: { ...process.env, HOME: home, USERPROFILE: home },
      });
      expect('installer: exits 0 with a symlinked entry present', r.status === 0, r.stderr || r.stdout);
      const landed = path.join(home, '.claude', 'skills', 'mental-models', 'references', '_symtest_dir', 'canary.md');
      expect('installer: symlinked content is resolved and copied, not skipped',
        fs.existsSync(landed) && fs.readFileSync(landed, 'utf8').includes('canary content'),
        `expected content at ${landed}`);
    } finally {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  }

  // A failed install must leave the PREVIOUS install intact. The old order
  // deleted the destination and then copied into the gap, so a crash midway
  // produced a half-populated directory with no marker — which the next run
  // then refuses to touch, because a directory without the marker looks
  // hand-made. Staging + rename makes the failure mode "nothing happened".
  {
    const good = spawnSync(process.execPath, [INSTALL, '--harness', 'claude', '--skill', 'cli-tooling'], {
      encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home },
    });
    expect('installer: baseline install succeeds', good.status === 0, good.stderr || good.stdout);
    const installed = path.join(home, '.claude', 'skills', 'cli-tooling');
    const marker = path.join(installed, '.agent-skills-install.json');
    expect('installer: marker written', fs.existsSync(marker), marker);

    // No staging directory may survive a successful run.
    const strays = fs.readdirSync(path.join(home, '.claude', 'skills'))
      .filter((n) => n.includes('.installing-'));
    expect('installer: no staging directory left behind', strays.length === 0, strays.join(', '));
  }
}
