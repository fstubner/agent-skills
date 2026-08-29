import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 9. Installer: Codex uses one canonical path and removes its legacy duplicate ----------
{
  const fakeHome = fs.mkdtempSync(path.join(tmpBase, 'installer-fakehome-'));
  const legacy = path.join(fakeHome, '.codex', 'skills', 'mental-models');
  fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, 'SKILL.md'), 'legacy managed copy');
  fs.writeFileSync(path.join(legacy, '.agent-skills-install.json'), JSON.stringify({
    suite: registry.name, version: '0.0.0',
  }));
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'install.mjs'), '--harness', 'codex', '--skill', 'mental-models'],
    { cwd: root, encoding: 'utf8', env: { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome } });
  expect('install.mjs --harness codex: exits 0', r.status === 0, r.stderr || r.stdout);
  expect('install.mjs --harness codex: installs to ~/.agents/skills',
    fs.existsSync(path.join(fakeHome, '.agents', 'skills', 'mental-models', 'SKILL.md')));
  expect('install.mjs --harness codex: removes its obsolete managed ~/.codex/skills copy',
    !fs.existsSync(legacy));
  expect('install.mjs --harness codex: reports 1 target(s)', /1 target\(s\)/.test(r.stdout), r.stdout);
}

// ---------- 9a. Telemetry installer: preserve, merge, deduplicate, remove ----------
{
  const fakeHome = fs.mkdtempSync(path.join(tmpBase, 'telemetry-home-'));
  const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome };
  const script = path.join(root, 'scripts', 'install-telemetry.mjs');
  const claudeSettings = path.join(fakeHome, '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(claudeSettings), { recursive: true });
  fs.writeFileSync(claudeSettings, JSON.stringify({ hooks: { PostToolUse: [{ matcher: 'Bash', hooks: [{ command: 'keep-me' }] }] } }));

  const run = (extra = []) => spawnSync(process.execPath, [script, '--harness', 'all', ...extra], {
    cwd: root, encoding: 'utf8', env,
  });
  const first = run();
  const second = run();
  expect('telemetry installer: installs all harness hooks', first.status === 0, first.stderr || first.stdout);
  expect('telemetry installer: rerun is idempotent', second.status === 0, second.stderr || second.stdout);
  expect('telemetry installer: copies a standalone adapter and registry',
    fs.existsSync(path.join(fakeHome, '.agent-skills-telemetry', 'adapter', 'log-skill-invocation.mjs'))
      && fs.existsSync(path.join(fakeHome, '.agent-skills-telemetry', 'adapter', 'registry.json')));

  const claude = JSON.parse(fs.readFileSync(claudeSettings, 'utf8'));
  expect('telemetry installer: preserves existing Claude hooks',
    claude.hooks.PostToolUse.some((item) => item.hooks?.some((hook) => hook.command === 'keep-me')));
  expect('telemetry installer: does not duplicate Claude hook on rerun',
    claude.hooks.PostToolUse.filter((item) => item.hooks?.some((hook) => hook.command?.includes('agent-skills-telemetry'))).length === 1);

  const codex = JSON.parse(fs.readFileSync(path.join(fakeHome, '.codex', 'hooks.json'), 'utf8'));
  const cursor = JSON.parse(fs.readFileSync(path.join(fakeHome, '.cursor', 'hooks.json'), 'utf8'));
  const antigravity = JSON.parse(fs.readFileSync(path.join(fakeHome, '.gemini', 'config', 'hooks.json'), 'utf8'));
  expect('telemetry installer: Codex uses a PostToolUse observer',
    codex.hooks.PostToolUse.length === 1 && /Bash/.test(codex.hooks.PostToolUse[0].matcher)
      && /shell_command/.test(codex.hooks.PostToolUse[0].matcher));
  expect('telemetry installer: Cursor observes successful Read tools',
    cursor.version === 1 && cursor.hooks.postToolUse.length === 1 && cursor.hooks.postToolUse[0].matcher === 'Read');
  expect('telemetry installer: Antigravity observes transcripts after model invocation',
    antigravity['agent-skills-telemetry']?.PostInvocation?.length === 1);

  const removed = run(['--remove']);
  expect('telemetry installer: remove exits 0', removed.status === 0, removed.stderr || removed.stdout);
  const removedClaude = JSON.parse(fs.readFileSync(claudeSettings, 'utf8'));
  const removedAg = JSON.parse(fs.readFileSync(path.join(fakeHome, '.gemini', 'config', 'hooks.json'), 'utf8'));
  expect('telemetry installer: remove preserves unrelated hooks',
    removedClaude.hooks.PostToolUse.some((item) => item.hooks?.some((hook) => hook.command === 'keep-me')));
  expect('telemetry installer: remove deletes only its Antigravity entry',
    !('agent-skills-telemetry' in removedAg));
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
  fs.writeFileSync(path.join(victim, '.agent-skills-install.json'),
    JSON.stringify({ suite: 'foreign-suite', version: '9.9.9' }));
  const foreign = spawnSync(process.execPath,
    [path.join(root, 'scripts', 'install.mjs'), '--dest', dest, '--skill', 'mental-models'],
    { cwd: root, encoding: 'utf8' });
  expect('installer: a foreign marker does not prove ownership',
    foreign.status !== 0 && fs.existsSync(path.join(victim, 'PRECIOUS.txt')), foreign.stderr || foreign.stdout);
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

// ---------- 9d. Installer: the marker must identify the source tree, not just its version ----------
//
// VERSION does not move per commit. Between v1.0.0-alpha.13 and the tree that
// followed it, nine commits all stamped `1.0.0-alpha.22`, so a marker reading
// alpha.22 was true of both a current install and a twelve-day-stale one. Found
// in the field on 2026-08-29: ~/.gemini/antigravity-cli/skills read alpha.22
// while its SKILL.md predated 412da6b. The marker reported current; the install
// was stale, and nothing in the marker could say so.
//
// Nobody reads this file until they are already debugging a stale install, which
// is exactly when a wrong answer costs the most — hence a test rather than a
// convention.
{
  const home = fs.mkdtempSync(path.join(tmpBase, 'installer-provenance-'));
  const INSTALL = path.join(root, 'scripts', 'install.mjs');
  const git = (...a) => spawnSync('git', ['-C', root, ...a], { encoding: 'utf8' });

  const r = spawnSync(process.execPath, [INSTALL, '--harness', 'claude', '--skill', 'mental-models'], {
    encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home },
  });
  expect('installer(provenance): install from a git checkout succeeds', r.status === 0, r.stderr || r.stdout);

  const marker = JSON.parse(read(path.join(home, '.claude', 'skills', 'mental-models', '.agent-skills-install.json')));
  const headSha = git('rev-parse', 'HEAD').stdout.trim();
  expect('installer(provenance): marker records the source commit',
    marker.gitCommitSha === headSha, `marker=${marker.gitCommitSha} head=${headSha}`);
  expect('installer(provenance): marker records a human-readable describe',
    typeof marker.gitDescribe === 'string' && marker.gitDescribe.length > 0,
    JSON.stringify(marker.gitDescribe));
  // --untracked-files=no on purpose: `git describe --dirty` reports only
  // TRACKED modifications, so comparing it against a porcelain status that
  // counts untracked files makes this test fail for anyone holding a new file
  // — which is every author mid-change, and was this test's own first red.
  expect('installer(provenance): describe reflects a dirty tree when tracked files are modified',
    String(marker.gitDescribe).endsWith('-dirty') === (git('status', '--porcelain', '--untracked-files=no').stdout.trim().length > 0),
    `describe=${marker.gitDescribe}`);

  // A source with no git history — an extracted tarball, a vendored copy — must
  // install cleanly and simply omit the fields. Recording nothing is honest;
  // recording a sha from some unrelated enclosing repository is not.
  const bare = path.join(home, 'suite-without-git');
  fs.mkdirSync(path.join(bare, 'scripts'), { recursive: true });
  fs.copyFileSync(INSTALL, path.join(bare, 'scripts', 'install.mjs'));
  for (const f of ['registry.json', 'VERSION']) fs.copyFileSync(path.join(root, f), path.join(bare, f));
  for (const d of ['core', 'mental-models']) fs.cpSync(path.join(root, d), path.join(bare, d), { recursive: true });

  const home2 = fs.mkdtempSync(path.join(tmpBase, 'installer-nogit-'));
  const r2 = spawnSync(process.execPath, [path.join(bare, 'scripts', 'install.mjs'), '--harness', 'claude', '--skill', 'mental-models'], {
    encoding: 'utf8', env: { ...process.env, HOME: home2, USERPROFILE: home2 },
  });
  expect('installer(provenance): install from a non-git source still succeeds', r2.status === 0, r2.stderr || r2.stdout);

  const marker2 = JSON.parse(read(path.join(home2, '.claude', 'skills', 'mental-models', '.agent-skills-install.json')));
  expect('installer(provenance): non-git source omits gitCommitSha rather than guessing',
    !('gitCommitSha' in marker2), JSON.stringify(marker2));
  expect('installer(provenance): non-git source omits gitDescribe rather than guessing',
    !('gitDescribe' in marker2), JSON.stringify(marker2));
  expect('installer(provenance): non-git source still records suite and version',
    marker2.suite === registry.name && typeof marker2.version === 'string', JSON.stringify(marker2));

  // Vendoring the suite into someone else's repository. `git rev-parse HEAD`
  // answers happily here — with THAT project's commit, which would be recorded
  // as this suite's provenance and read as authoritative. The enclosing-repo
  // case is the one the repository-root guard exists for; without it the
  // assertions above still pass, because a temp directory has no enclosing
  // repository to be confused by.
  const host = fs.mkdtempSync(path.join(tmpBase, 'installer-vendored-'));
  const hostGit = (...a) => spawnSync('git', ['-C', host, ...a], { encoding: 'utf8' });
  hostGit('init', '-q');
  hostGit('config', 'user.email', 'test@example.invalid');
  hostGit('config', 'user.name', 'Test');
  fs.writeFileSync(path.join(host, 'README.md'), 'someone else project\n');
  hostGit('add', '-A');
  hostGit('commit', '-qm', 'host project');
  const hostSha = hostGit('rev-parse', 'HEAD').stdout.trim();
  expect('installer(provenance): the vendoring fixture is a real repo', /^[0-9a-f]{40}$/.test(hostSha), hostSha);

  const vendored = path.join(host, 'vendor', 'agent-skills');
  fs.cpSync(bare, vendored, { recursive: true });
  const home3 = fs.mkdtempSync(path.join(tmpBase, 'installer-vendored-home-'));
  const r3 = spawnSync(process.execPath, [path.join(vendored, 'scripts', 'install.mjs'), '--harness', 'claude', '--skill', 'mental-models'], {
    encoding: 'utf8', env: { ...process.env, HOME: home3, USERPROFILE: home3 },
  });
  expect('installer(provenance): install from a vendored copy succeeds', r3.status === 0, r3.stderr || r3.stdout);

  const marker3 = JSON.parse(read(path.join(home3, '.claude', 'skills', 'mental-models', '.agent-skills-install.json')));
  expect('installer(provenance): a vendored copy does not claim the host repo\'s commit',
    marker3.gitCommitSha === undefined, `recorded ${marker3.gitCommitSha}, host is ${hostSha}`);
  expect('installer(provenance): a vendored copy records no describe either',
    marker3.gitDescribe === undefined, JSON.stringify(marker3.gitDescribe));
}
