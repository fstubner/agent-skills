import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { root, read, expect, runNode, tmpBase } from './harness.mjs';

// Split out of hooks.mjs: that file crossed the 400-line bar this suite
// enforces on everyone else, and the hook blocked the commit that would
// have shipped it.
// ---------- 8g. The hook cannot be switched off by the commit it inspects ----------
// check-backend.js has always passed --config and --ignore-gitleaks-allow;
// this hook passed neither, so both documented bypasses worked locally.
// core/gitleaks-defaults.toml's header records the verification: a live ghp_
// token went from fail to pass purely by adding a .gitleaks.toml.
//
// The threat is not exotic. The thing being scanned is the thing that can
// write the config, and an agent that wants its commit to pass can write
// both files. Found by audit, 2026-08-02.
{
  const hookPath = path.join(root, 'scripts', 'git-hooks', 'pre-commit');
  const probe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    console.log('skip  gitleaks bypass tests: gitleaks not installed');
  } else {
    const repo = fs.mkdtempSync(path.join(tmpBase, 'bypass-'));
    const git = (a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
    git(['init', '-q']);
    git(['config', 'user.email', 't@e.com']);
    git(['config', 'user.name', 'T']);
    const run = () => spawnSync(process.execPath, [hookPath], { cwd: repo, encoding: 'utf8' });
    const KEY = 'sk_' + 'live_' + 'abcdefghijklmnopqrstuvwx';

    // Baseline: the key alone must block, or the bypass tests below prove nothing.
    fs.writeFileSync(path.join(repo, 'app.js'), `const k = "${KEY}";\n`);
    git(['add', 'app.js']);
    expect('bypass baseline: a staged key blocks', run().status === 1, 'baseline did not block');

    // Bypass 1: a committed .gitleaks.toml that allowlists everything.
    fs.writeFileSync(path.join(repo, '.gitleaks.toml'),
      'title = "x"\n[allowlist]\ndescription = "off"\npaths = [\'\'\'.*\'\'\']\n');
    git(['add', '.gitleaks.toml', 'app.js']);
    expect('hook ignores a .gitleaks.toml planted in the scanned repo',
      run().status === 1, 'ALLOWLIST BYPASS: repo config switched the scan off');
    fs.rmSync(path.join(repo, '.gitleaks.toml'));
    git(['rm', '-q', '--cached', '.gitleaks.toml']);

    // Bypass 2: an inline gitleaks:allow comment on the offending line.
    fs.writeFileSync(path.join(repo, 'app.js'), `const k = "${KEY}"; // gitleaks:allow\n`);
    git(['add', 'app.js']);
    expect('hook ignores an inline gitleaks:allow comment',
      run().status === 1, 'INLINE-ALLOW BYPASS: the commit waved itself through');

    // Still no false positives after hardening.
    git(['reset', '-q']);
    fs.writeFileSync(path.join(repo, 'app.js'), 'const greeting = "hello";\n');
    git(['add', 'app.js']);
    expect('hardened hook still allows a clean file', run().status === 0, 'false positive after hardening');
  }
}

// ---------- 8g. The scan set goes via a file, not the command line ----------
// A real commit here staged 2,424 paths. Joined into one argv entry over
// 100KB, spawnSync returned ENAMETOOLONG for all three scoped checkers —
// each reported "could not run — skipped" and the commit went through
// unchecked. The gate stopped running on exactly the largest commits, and
// announced it in a warning nobody reads.
{
  const src = read(path.join(root, 'scripts', 'git-hooks', 'pre-commit'));
  expect('pre-commit passes the scan set as --files-from',
    src.includes('--files-from') && src.includes('fileListPath'),
    'the hook still joins the staged list into argv');
  expect('pre-commit no longer joins the scan set into argv',
    !/checkable\.join\(','\)/.test(src));

  const many = path.join(tmpBase, 'files-from-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(path.join(many, 'src'), { recursive: true });
  const names = [];
  for (let i = 0; i < 2500; i++) {
    const rel = 'src/mod' + i + '.js';
    fs.writeFileSync(path.join(many, rel), 'export const x' + i + ' = ' + i + ';\n');
    names.push(rel);
  }
  const deep = 'function f(){\n' + '  if (a) {\n'.repeat(7) + 'x();\n' + '}\n'.repeat(7) + '}\n';
  fs.writeFileSync(path.join(many, 'src', 'deep.js'), deep);
  names.push('src/deep.js');
  const listPath = path.join(many, 'scan-set.txt');
  fs.writeFileSync(listPath, names.join('\n'));

  const smells = path.join(root, 'code-smells', 'scripts', 'check-smells.js');
  const viaFile = runNode(smells, ['--root', many, '--files-from', listPath, '--no-write']);
  const viaArgs = runNode(smells, ['--root', many, '--files', 'src/deep.js', '--no-write']);
  let fileVerdict = 'unparseable';
  let argVerdict = 'unparseable';
  try { fileVerdict = JSON.parse(viaFile.stdout).verdict; } catch { /* reported below */ }
  try { argVerdict = JSON.parse(viaArgs.stdout).verdict; } catch { /* reported below */ }
  expect('--files-from BLOCKs on a 2501-path scan set that --files cannot carry',
    fileVerdict === 'BLOCK' && argVerdict === 'BLOCK',
    'files-from=' + fileVerdict + ' files=' + argVerdict);

  for (const rel of ['code-organization/scripts/check-organization.js', 'data-modeling/scripts/check-migrations.js']) {
    const r = runNode(path.join(root, ...rel.split('/')), ['--root', many, '--files-from', listPath, '--no-write']);
    let parsed = null;
    try { parsed = JSON.parse(r.stdout); } catch { /* asserted below */ }
    expect(rel + ' accepts --files-from', parsed !== null, (r.stderr || '').slice(0, 160));
  }

  const absent = runNode(smells, ['--root', many, '--files-from', path.join(many, 'nope.txt'), '--no-write']);
  expect('--files-from with an unreadable list does not crash',
    absent.status === 0 || absent.status === 1, 'exit ' + absent.status);
}
