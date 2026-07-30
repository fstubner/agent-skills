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

// ---------- 8b. Skill-invocation telemetry hook ----------
// The hook exists because this suite measured ~0% spontaneous skill
// invocation (eval/results/): a telemetry SKILL would only record the
// sessions where the model remembered to record, which is the same
// selection bias that makes the question unanswerable. A PostToolUse hook
// fires unconditionally, so the denominator is real.
//
// Every assertion below is about a failure mode that would make the hook
// worse than useless: logging the wrong tools (drowns the signal), or
// throwing on a malformed payload (breaks the user's session, gets the
// hook uninstalled, takes the measurement with it).
{
  const LOGGER = path.join(root, 'scripts', 'log-skill-invocation.mjs');
  const dir = fs.mkdtempSync(path.join(tmpBase, 'telemetry-'));
  const logPath = path.join(dir, '.agent-skills-telemetry', 'invocations.jsonl');
  const feed = (payload) => spawnSync(process.execPath, [LOGGER], { input: payload, encoding: 'utf8' });
  const rows = () => (fs.existsSync(logPath)
    ? fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : []);

  const skillCall = feed(JSON.stringify({
    tool_name: 'Skill', tool_input: { skill: 'product-build' }, cwd: dir, session_id: 'sess-1',
  }));
  expect('telemetry: exits 0 on a real Skill payload', skillCall.status === 0, `exit ${skillCall.status}`);
  expect('telemetry: records the skill name', rows().length === 1 && rows()[0].skill === 'product-build',
    JSON.stringify(rows()));
  expect('telemetry: records the session id', rows()[0] && rows()[0].session === 'sess-1', JSON.stringify(rows()));

  feed(JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/x' }, cwd: dir }));
  expect('telemetry: a non-Skill tool is NOT logged (matcher cannot be relied on alone)',
    rows().length === 1, `${rows().length} row(s)`);

  const garbage = feed('not json at all');
  expect('telemetry: unparseable stdin exits 0 and logs nothing',
    garbage.status === 0 && rows().length === 1, `exit ${garbage.status}, ${rows().length} row(s)`);

  const empty = feed('');
  expect('telemetry: empty stdin exits 0', empty.status === 0, `exit ${empty.status}`);

  // An unrecognised payload shape must still COUNT the invocation — the
  // whole point is the denominator. Dropping the row would silently
  // under-report exactly when the harness changes its payload format.
  feed(JSON.stringify({ tool_name: 'Skill', unexpected: { shape: 1 }, cwd: dir }));
  expect('telemetry: an unknown payload shape still counts, with skill null',
    rows().length === 2 && rows()[1].skill === null, JSON.stringify(rows()));
}
