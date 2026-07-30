import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 8. Pre-commit secret-scanning hook (skips only when gitleaks is absent) ----------
// Node, shelling out to `gitleaks` — Node is already a de facto
// prerequisite for the coding-agent harnesses this suite targets, and
// gitleaks is a real, maintained secret-detection tool this suite doesn't
// try to reimplement (same "use the real tool" choice as vale for
// ai-prose-slop). Functional tests actually init a git repo, stage real
// content, and run the hook against it — proving the hook's OWN plumbing
// (gitleaks invocation, report parsing, exit code), not just that gitleaks
// itself works in isolation.
{
  const hookPath = path.join(root, 'scripts', 'git-hooks', 'pre-commit');
  const syntaxCheck = spawnSync(process.execPath, ['--check', hookPath], { encoding: 'utf8' });
  expect('syntax scripts/git-hooks/pre-commit', syntaxCheck.status === 0, (syntaxCheck.stderr || '').split('\n')[0]);

  const gitleaksProbe = spawnSync('gitleaks', ['version'], { encoding: 'utf8' });
  if (gitleaksProbe.error || gitleaksProbe.status !== 0) {
    console.log('skip  pre-commit hook fixtures: gitleaks not installed (CI installs it; install locally to run these)');
  } else {
    const hookRepo = fs.mkdtempSync(path.join(tmpBase, 'hook-repo-'));
    const git = (args) => spawnSync('git', args, { cwd: hookRepo, encoding: 'utf8' });
    git(['init', '-q']);
    git(['config', 'user.email', 'test@example.com']);
    git(['config', 'user.name', 'Test']);
    const run = () => spawnSync(process.execPath, [hookPath], { cwd: hookRepo, encoding: 'utf8' });

    // Assembled at runtime, never written as one literal. A test for a secret
    // scanner necessarily contains secret-SHAPED input, and once this block
    // moved out of run-tests.mjs into a new file, the whole file became part
    // of the staged diff and this suite's own pre-commit hook flagged its own
    // fixtures. Same reasoning (and same fix) as the crypto.randomBytes keys
    // in fail-closed.mjs: keep the value realistic at runtime, keep the
    // source text unmatched, don't weaken the scanner or allow-list around it.
    const STRIPE_KEY = 'sk_' + 'live_' + 'abcdefghijklmnopqrstuvwx';
    const ANTHROPIC_KEY = 'sk-' + 'ant-' + 'api03-' + 'abcdefghijklmnopqrstuvwxyz1234567890';

    fs.writeFileSync(path.join(hookRepo, 'app.js'), `const key = "${STRIPE_KEY}";\n`);
    git(['add', 'app.js']);
    const blocked = run();
    expect('pre-commit hook: blocks a staged Stripe-shaped key', blocked.status === 1, `exit ${blocked.status}: ${blocked.stderr}`);
    expect('pre-commit hook: reports the path and rule, never the value',
      blocked.stderr.includes('app.js') && blocked.stderr.includes('stripe') && !blocked.stderr.includes(STRIPE_KEY),
      blocked.stderr);

    git(['reset']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), `const key = "${ANTHROPIC_KEY}";\n`);
    git(['add', 'app.js']);
    const blockedExtra = run();
    expect('pre-commit hook: blocks an Anthropic-shaped key (core/gitleaks-extra.toml pass)',
      blockedExtra.status === 1 && blockedExtra.stderr.includes('anthropic'), `exit ${blockedExtra.status}: ${blockedExtra.stderr}`);

    git(['reset']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const greeting = "hello";\n');
    git(['add', 'app.js']);
    const clean = run();
    expect('pre-commit hook: allows a clean staged file', clean.status === 0, `exit ${clean.status}: ${clean.stderr}`);

    // Regression: v0.4's hand-rolled scanner BLOCKed on the bare phrase
    // "task-management" with no real key prefix — gitleaks' own anchored
    // rules shouldn't reproduce that false positive.
    fs.writeFileSync(path.join(hookRepo, 'app2.js'), 'const feature = "task-management-app";\n');
    git(['add', 'app2.js']);
    const notASecret = run();
    expect('pre-commit hook: "task-management" is not a secret', notASecret.status === 0, `exit ${notASecret.status}: ${notASecret.stderr}`);

    // Regression: must check the STAGED blob, not the working-tree file —
    // `gitleaks protect --staged` is documented to do this; asserted here
    // so a future flag change can't silently regress it unnoticed.
    git(['reset']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), 'const greeting = "hello";\n');
    git(['add', 'app.js']);
    fs.writeFileSync(path.join(hookRepo, 'app.js'), `const key = "${STRIPE_KEY}";\n`);
    const stagedVsWorktree = run();
    expect('pre-commit hook: judges the staged blob, not unstaged working-tree edits',
      stagedVsWorktree.status === 0, `exit ${stagedVsWorktree.status}: ${stagedVsWorktree.stderr}`);
  }
}
