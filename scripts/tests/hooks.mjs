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
  // The writer targets ONE user-level dir (not the project cwd — v1 littered
  // .agent-skills-telemetry/ into every repo the user touched). Tests point
  // it at a temp dir via the same env override users get.
  const logPath = path.join(dir, 'invocations.jsonl');
  const feed = (payload) => spawnSync(process.execPath, [LOGGER], {
    input: payload, encoding: 'utf8',
    env: { ...process.env, AGENT_SKILLS_TELEMETRY_DIR: dir },
  });
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

// ---------- 8c. The hook's SCOPED_CHECKERS list must stay true ----------
// Two ways this silently rots: a script gets renamed/moved and the hook
// quietly skips it (missing checkers warn rather than block, by design), or a
// checker is rewritten without --files and starts scanning the whole repo on
// every commit — reintroducing the exact problem --files exists to solve.
// Neither shows up as a test failure anywhere else.
{
  const hookSrc = read(path.join(root, 'scripts', 'git-hooks', 'pre-commit'));
  const listed = [...hookSrc.matchAll(/skill:\s*'([^']+)',\s*script:\s*path\.join\(repoRoot,\s*([^)]+)\)/g)]
    .map((m) => ({
      skill: m[1],
      rel: m[2].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).join('/'),
    }));

  expect('pre-commit: SCOPED_CHECKERS parsed from the hook source', listed.length >= 3,
    `parsed ${listed.length}`);

  for (const { skill, rel } of listed) {
    const full = path.join(root, ...rel.split('/'));
    expect(`pre-commit: ${skill} checker exists at the path the hook uses`,
      fs.existsSync(full), rel);
    if (!fs.existsSync(full)) continue;

    // Behavioural, not a grep for the string "--files": run it scoped to a
    // path that doesn't exist and require a clean, parseable, non-blocking
    // report. A checker that ignored --files would walk the whole repo here.
    const r = runNode(full, ['--root', root, '--files', 'does/not/exist.xyz']);
    let report = null;
    try { report = JSON.parse(r.stdout); } catch { /* asserted below */ }
    expect(`pre-commit: ${skill} honours --files (parseable report)`,
      report !== null, (r.stderr || '').slice(0, 160));
    expect(`pre-commit: ${skill} honours --files (no findings from an unrelated path)`,
      report !== null && report.verdict !== 'BLOCK',
      report ? JSON.stringify(report.checks) : 'no report');
  }
}

// ---------- 8d. skill-usage.mjs (the reader for 8b's writer) ----------
// Driven through the REAL logger rather than hand-written JSONL: the reader
// and writer are a contract, and a test that fabricated the log format would
// keep passing if the writer's shape drifted — the exact failure this pair
// exists to detect.
{
  const LOGGER = path.join(root, 'scripts', 'log-skill-invocation.mjs');
  const USAGE = path.join(root, 'scripts', 'skill-usage.mjs');
  const proj = fs.mkdtempSync(path.join(tmpBase, 'usage-'));
  const logPath = path.join(proj, 'invocations.jsonl');
  const report = () => JSON.parse(runNode(USAGE, ['--root', root, '--log', logPath, '--json']).stdout);

  // Empty state is the NORMAL first run, not an error — it must exit 0 and
  // still report the registry denominator, since "0 of 15 ever fired" is the
  // finding this whole mechanism was built to surface.
  const empty = runNode(USAGE, ['--root', root, '--log', logPath, '--json']);
  expect('skill-usage: missing log exits 0', empty.status === 0, `exit ${empty.status}`);
  const emptyRep = JSON.parse(empty.stdout);
  expect('skill-usage: missing log reports zero invocations', emptyRep.totalInvocations === 0,
    JSON.stringify(emptyRep.totalInvocations));
  expect('skill-usage: missing log still lists every registered skill as never-invoked',
    Array.isArray(emptyRep.neverInvoked) && emptyRep.neverInvoked.length === emptyRep.registrySkills,
    `${emptyRep.neverInvoked && emptyRep.neverInvoked.length} of ${emptyRep.registrySkills}`);

  const feed = (skill, session) => spawnSync(process.execPath, [LOGGER], {
    input: JSON.stringify({ tool_name: 'Skill', tool_input: { skill }, cwd: proj, session_id: session }),
    encoding: 'utf8',
    env: { ...process.env, AGENT_SKILLS_TELEMETRY_DIR: proj },
  });
  feed('product-build', 's1');
  feed('product-build', 's1');
  feed('frontend', 's2');

  const rep = report();
  expect('skill-usage: counts invocations written by the real logger', rep.totalInvocations === 3,
    JSON.stringify(rep.totalInvocations));
  expect('skill-usage: tallies per skill', rep.bySkill['product-build'] === 2 && rep.bySkill.frontend === 1,
    JSON.stringify(rep.bySkill));
  expect('skill-usage: counts distinct sessions', rep.sessions === 2, JSON.stringify(rep.sessions));
  expect('skill-usage: invoked skills are absent from neverInvoked',
    !rep.neverInvoked.includes('product-build') && !rep.neverInvoked.includes('frontend'),
    JSON.stringify(rep.neverInvoked));
  expect('skill-usage: an uninvoked registered skill IS listed as never-invoked',
    rep.neverInvoked.includes('code-smells'), JSON.stringify(rep.neverInvoked));

  // A torn line must be counted, not silently dropped — quietly shrinking the
  // denominator would corrupt the one number this tool exists to report.
  fs.appendFileSync(logPath, 'CORRUPT{not json\n');
  const withBad = report();
  expect('skill-usage: malformed lines are counted, not silently dropped',
    withBad.malformedLines === 1 && withBad.totalInvocations === 3,
    `malformed=${withBad.malformedLines} total=${withBad.totalInvocations}`);
}

// ---------- 8e. SessionStart output-style injection ----------
// A response-style rule has to be always-on, so it cannot be a skill (~0%
// unprompted invocation, eval/results/) and cannot be an output style (that
// feature is deprecated; Anthropic's own explanatory-output-style plugin
// recreates it as a SessionStart hook). These pin the two ways this silently
// stops working: the file goes missing, or the hook stops emitting it.
{
  const INJECT = path.join(root, 'concise-style', 'scripts', 'inject-output-style.mjs');
  const STYLE = path.join(root, 'concise-style', 'output-style', 'concise.md');
  const run = (payload) => spawnSync(process.execPath, [INJECT], { input: payload, encoding: 'utf8' });

  expect('output-style: concise.md exists', fs.existsSync(STYLE), STYLE);

  const r = run(JSON.stringify({ hook_event_name: 'SessionStart' }));
  expect('output-style: hook exits 0', r.status === 0, `exit ${r.status}`);
  expect('output-style: hook emits the file verbatim', r.stdout.trimEnd() === read(STYLE).trimEnd(),
    `emitted ${r.stdout.length} bytes, file is ${read(STYLE).length}`);

  // Non-ASCII must survive. A Windows console defaults to the locale codepage,
  // which is exactly what silently killed the harness-dispatch SessionStart
  // hook on this machine — UnicodeEncodeError, no output, no error surfaced.
  expect('output-style: non-ASCII survives stdout encoding', r.stdout.includes('—'),
    'em dash lost in transit');

  // Must not depend on a well-formed payload: SessionStart fires on startup,
  // resume and compaction, and a style preference that can break a session is
  // a style preference that gets uninstalled.
  for (const [label, payload] of [['empty stdin', ''], ['garbage stdin', 'not json']]) {
    const bad = run(payload);
    expect(`output-style: ${label} still exits 0 and emits the rules`,
      bad.status === 0 && bad.stdout.includes('Response style'), `exit ${bad.status}`);
  }

  // The rules are only reachable if the plugin actually registers the hook.
  const hooks = JSON.parse(read(path.join(root, 'concise-style', 'hooks', 'hooks.json')));
  const starts = (hooks.hooks && hooks.hooks.SessionStart) || [];
  const cmds = starts.flatMap((s) => (s.hooks || []).map((h) => h.command || ''));
  expect('output-style: plugin registers a SessionStart hook for it',
    cmds.some((c) => c.includes('inject-output-style.mjs')), JSON.stringify(cmds));

  // The style file states a hard default; if that line goes, the whole
  // document degrades into suggestions and the failure it exists to fix
  // (correct but three times too long) comes straight back.
  const styleText = read(STYLE);
  expect('output-style: states a hard default length', /##\s*The default/i.test(styleText), 'missing');
  expect('output-style: forbids closing summaries', /closing summary/i.test(styleText), 'missing');
}

// ---------- 8f. The hook exempts fixtures/ from CONTENT checks only ----------
// fixtures/ is deliberately defective — that is its whole function. Running
// the scoped checkers over it blocked the commit that ADDED a block-fixture,
// i.e. the hook forbidding the test data that proves the hook works. Caught
// the first time a minified-bundle fixture was staged.
//
// The exemption must stay narrow in two directions, both pinned here: it
// covers fixtures/ and nothing else, and it does NOT extend to gitleaks,
// because a real credential in fixtures/ is a real leak regardless of what
// the directory is for.
{
  const src = read(path.join(root, 'scripts', 'git-hooks', 'pre-commit'));

  const exemptBlock = src.match(/const CONTENT_EXEMPT = \[([^\]]*)\]/);
  expect('pre-commit: CONTENT_EXEMPT is declared', Boolean(exemptBlock), 'not found');
  if (exemptBlock) {
    const patterns = exemptBlock[1].match(/\/\^?[^/]+\//g) || [];
    expect('pre-commit: exemption covers fixtures/ and nothing else',
      patterns.length === 1 && /fixtures/.test(patterns[0]), JSON.stringify(patterns));
  }

  // The scoped checkers must receive the FILTERED list. Passing the unfiltered
  // one would make the exemption dead code that reads as protection.
  expect('pre-commit: scoped checkers are given the filtered file list',
    /'--files',\s*checkable\.join/.test(src) && !/'--files',\s*staged\.join/.test(src),
    'checkers still receive the unfiltered staged list');

  // gitleaks must run before, and independently of, the exemption.
  const gitleaksAt = src.indexOf('gitleaks protect');
  const exemptAt = src.indexOf('CONTENT_EXEMPT');
  expect('pre-commit: gitleaks scans staged files regardless of the exemption',
    gitleaksAt !== -1 && exemptAt !== -1 && gitleaksAt < exemptAt,
    `gitleaks@${gitleaksAt} exempt@${exemptAt}`);
}
