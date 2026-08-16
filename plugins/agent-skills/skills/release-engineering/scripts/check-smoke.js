#!/usr/bin/env node
'use strict';
// Does the project's declared way of running itself actually resolve?
//
// This is the deterministic floor under product-acceptance's A-runtime,
// which is an ASSERTION by an independent acceptor ("I ran it and the
// critical path worked") with nothing mechanical behind it. Nothing here
// proves the product works — it proves the commands a human would type are
// not pointing at files that don't exist. Found by eval: a build declared
// `"test": "node --test test/"` and shipped no test/ directory, so the
// command failed instantly and no check in the suite noticed.
//
// DELIBERATELY DOES NOT EXECUTE ANYTHING by default. Running `npm test` in
// an audited project means executing whatever that project wrote, which is
// not a thing this suite does anywhere else (see SECURITY.md). --run is
// opt-in, off in acceptance, and documented as executing target code.
//
// Usage: node check-smoke.js --root <dir> [--strict] [--out <file>] [--no-write]

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { check, runCli } = require(path.join(core.lib, 'report.cjs'));
const registry = require(core.registry);

// npm's own `npm init` placeholder. A project carrying it has no test
// command, it just looks like it does — worth naming separately from
// "no test script at all" because the two get fixed differently.
const NPM_PLACEHOLDER = /no test specified/i;

// A token is only treated as a local path when it is unambiguous: an
// explicit ./ or ../ prefix, a source-file extension, or the argument to
// node's --test. Anything with a shell metacharacter, a glob, or a
// variable is left alone — a false "missing file" here would be worse
// than a miss, because the fix for it is unclear to the person reading it.
const AMBIGUOUS = /[*?$`|&<>(){}[\]]|^-|^\$/;
const SOURCE_EXT = /\.(m|c)?[jt]sx?$/;

function localPathTokens(command) {
  const tokens = command.split(/\s+/).filter(Boolean);
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '--test' || t === '--import' || t === '--require') {
      const next = tokens[i + 1];
      if (next && !AMBIGUOUS.test(next)) out.push(next);
      continue;
    }
    if (AMBIGUOUS.test(t)) continue;
    if (/^\.{1,2}\//.test(t) || SOURCE_EXT.test(t)) out.push(t);
  }
  return out;
}

function exists(root, rel) {
  const clean = rel.replace(/^\.\//, '').replace(/\/$/, '');
  return fs.existsSync(path.join(root, clean));
}

function readPackageJson(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

function entryPointsOf(pkg) {
  const out = [];
  if (typeof pkg.main === 'string') out.push(['main', pkg.main]);
  if (typeof pkg.module === 'string') out.push(['module', pkg.module]);
  if (typeof pkg.bin === 'string') out.push(['bin', pkg.bin]);
  else if (pkg.bin && typeof pkg.bin === 'object') {
    for (const [name, file] of Object.entries(pkg.bin)) {
      if (typeof file === 'string') out.push([`bin.${name}`, file]);
    }
  }
  return out;
}

const TEST_FILE = /(\.|_)(test|spec)\.(m|c)?[jt]sx?$|^test_.*\.py$|_test\.go$|(\.|_)(test|spec)\.py$/i;
const TEST_DIR = /(^|[\\/])(test|tests|__tests__|spec)([\\/]|$)/i;
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'vendor', 'target', '.venv', 'venv', '.claude', '.cursor', '.codex', '.agents', '.aider', '.worktrees']);
const MAX_WALK = 20000;

function findTestFiles(root) {
  const found = [];
  let seen = 0;
  (function walk(dir, rel) {
    if (found.length >= 5 || seen >= MAX_WALK) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name), childRel);
      } else {
        seen++;
        // A file inside a test directory counts only if it is source —
        // a fixture .csv or a README in test/ is not a test.
        if (TEST_FILE.test(e.name) || (TEST_DIR.test(childRel) && SOURCE_EXT.test(e.name))) {
          found.push(childRel);
        }
      }
      if (found.length >= 5) return;
    }
  })(root, '');
  return found;
}

function run(root, opts = {}) {
  const pkg = readPackageJson(root);
  const checks = [];

  if (!pkg) {
    checks.push(check('R-scope', 'pass', 'no readable package.json; script and entry-point checks not applicable'));
    return checks;
  }

  // 1. Every declared script points at something that exists.
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const broken = [];
  for (const [name, command] of Object.entries(scripts)) {
    if (typeof command !== 'string') continue;
    for (const token of localPathTokens(command)) {
      if (!exists(root, token)) broken.push(`${name} -> ${token}`);
    }
  }
  checks.push(broken.length > 0
    ? check('R-script-targets', 'fail', `declared script(s) reference missing paths: ${broken.join('; ')}`)
    : check('R-script-targets', 'pass',
        `${Object.keys(scripts).length} declared script(s), all referenced paths present`));

  // 2. Entry points resolve.
  const entries = entryPointsOf(pkg);
  const missingEntries = entries.filter(([, file]) => !exists(root, file)).map(([k, f]) => `${k} -> ${f}`);
  if (entries.length === 0) {
    checks.push(check('R-entry-points', 'pass', 'no main/module/bin declared'));
  } else {
    checks.push(missingEntries.length > 0
      ? check('R-entry-points', 'fail', `declared entry point(s) missing: ${missingEntries.join('; ')}`)
      : check('R-entry-points', 'pass', `${entries.length} entry point(s) resolve`));
  }

  // 3. There is a way to run the tests at all.
  if (!scripts.test) {
    checks.push(check('R-test-command', 'fail', 'no "test" script declared; there is no stated way to run this project\'s tests'));
  } else if (NPM_PLACEHOLDER.test(scripts.test)) {
    checks.push(check('R-test-command', 'fail', `"test" script is npm's placeholder: ${scripts.test}`));
  } else {
    checks.push(check('R-test-command', 'pass', `test script: ${scripts.test}`));
  }

  // 4. A test command over an empty directory passes every check above —
  //    the path exists. Measured: all three arms of the oncall eval
  //    declared or scaffolded a test setup and none of them wrote a test.
  const testFiles = findTestFiles(root);
  checks.push(testFiles.length > 0
    ? check('R-tests-present', 'pass', `${testFiles.length} test file(s), e.g. ${testFiles[0]}`)
    : check('R-tests-present', 'fail', 'no test files found; a declared test command over an empty directory is not a test suite'));

  // 5. Opt-in execution. Never set by acceptance.
  if (opts.run && scripts.test && !NPM_PLACEHOLDER.test(scripts.test)) {
    const res = spawnSync('npm', ['test', '--silent'], {
      cwd: root, encoding: 'utf8', timeout: 300000, shell: process.platform === 'win32',
    });
    if (res.error) {
      checks.push(check('R-test-run', 'not_evaluated', `could not run npm test: ${res.error.message}`));
    } else {
      checks.push(res.status === 0
        ? check('R-test-run', 'pass', 'npm test exited 0')
        : check('R-test-run', 'fail', `npm test exited ${res.status}`));
    }
  }
  // No R-test-run check at all without --run. Emitting a standing
  // not_evaluated would pin every project at CONDITIONAL forever, and the
  // "nobody watched it run" fact is already carried by acceptance's
  // A-runtime, which is where it belongs.

  return checks;
}

module.exports = { run, localPathTokens };

if (require.main === module) {
  const artifact = registry.artifacts.find((a) => a.producer === 'release-engineering' && a.kind === 'report');
  const argv = process.argv.slice(2);
  const wantsRun = argv.includes('--run');
  runCli({
    skill: 'release-engineering',
    reportFile: path.basename(artifact.file),
    evidenceDir: registry.evidenceDir,
    runFn: (root) => run(root, { run: wantsRun }),
    argv: argv.filter((a) => a !== '--run'),
    parseArgs,
  });
}
