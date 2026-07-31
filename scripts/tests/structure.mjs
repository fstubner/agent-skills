import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  root, registry, read, expect, runNode, walk, pathToFileUrl,
  tmpBase, runFixture, assertFixture, ARCH, BACKEND, FRONTEND, ACCEPT,
} from './harness.mjs';

// ---------- 1. Syntax-check every script in the suite ----------
{
  const scripts = walk(root).filter((f) => /\.(js|cjs|mjs)$/.test(f));
  for (const s of scripts) {
    const r = spawnSync(process.execPath, ['--check', s], { encoding: 'utf8' });
    expect(`syntax ${path.relative(root, s)}`, r.status === 0, (r.stderr || '').split('\n')[0]);
  }
}

// ---------- 2. Registry <-> filesystem cross-check ----------
{
  const ids = registry.skills.map((s) => s.id);
  expect('registry: defaultSkill is a registered skill', ids.includes(registry.defaultSkill));
  for (const [harness, hPaths] of Object.entries(registry.harnessPaths)) {
    const list = Array.isArray(hPaths) ? hPaths : [hPaths];
    expect(`registry: harnessPaths.${harness} is a non-empty string or array of strings`,
      list.length > 0 && list.every((p) => typeof p === 'string' && p.startsWith('~')));
  }
  for (const skill of registry.skills) {
    const skillMd = path.join(root, skill.id, 'SKILL.md');
    expect(`registry: skill dir + SKILL.md exists (${skill.id})`, fs.existsSync(skillMd));
    if (!fs.existsSync(skillMd)) continue;
    const text = read(skillMd);
    const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
    expect(`frontmatter parses (${skill.id})`, Boolean(fmMatch));
    if (!fmMatch) continue;
    const nameMatch = fmMatch[1].match(/^name:\s*(\S+)\s*$/m);
    expect(`frontmatter name matches dir (${skill.id})`, Boolean(nameMatch) && nameMatch[1] === skill.id,
      nameMatch ? nameMatch[1] : 'no name:');
    const descBlock = fmMatch[1].replace(/^name:.*$/m, '');
    expect(`frontmatter description is substantial (${skill.id})`,
      /description:/.test(fmMatch[1]) && descBlock.replace(/\s+/g, ' ').length > 80);
  }
  // REVERSE check: every top-level directory that has a SKILL.md must be
  // registered. Without this, a new skill dropped on disk but never added
  // to registry.json passes every other test silently — never installed,
  // never gated, never documented (this was the exact shape of the v0.4
  // "backend-report produced but never consumed" bug: a producer that
  // exists on disk but has no registry entry to wire it in).
  const SKIP_TOP_LEVEL = new Set(['core', 'docs', 'eval', 'fixtures', 'scripts', 'node_modules', '.git', '.github']);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_TOP_LEVEL.has(entry.name) || entry.name.startsWith('.')) continue;
    if (!fs.existsSync(path.join(root, entry.name, 'SKILL.md'))) continue;
    expect(`registry: on-disk skill "${entry.name}" is registered in registry.json`, ids.includes(entry.name));
  }
  const KNOWN_REQUIRED_WHEN = ['always', 'never', 'multi_part', 'server_present', 'frontend_present'];
  for (const a of registry.artifacts) {
    expect(`registry: producer is a registered skill (${a.id})`, ids.includes(a.producer));
    for (const c of a.consumers) {
      expect(`registry: consumer is a registered skill (${a.id} -> ${c})`, ids.includes(c));
    }
    expect(`registry: requiredWhen is a known condition (${a.id}: ${a.requiredWhen})`,
      KNOWN_REQUIRED_WHEN.includes(a.requiredWhen));
    expect(`registry: acceptanceGated is a boolean (${a.id})`, typeof a.acceptanceGated === 'boolean');
    if (a.producerScript) {
      expect(`registry: producer script exists (${a.producerScript})`,
        fs.existsSync(path.join(root, ...a.producerScript.split('/'))));
    }
    if (a.schema) {
      expect(`registry: schema exists (${a.schema})`,
        fs.existsSync(path.join(root, ...a.schema.split('/'))));
    }
    // Report-kind artifacts with a producerScript must be structurally
    // derivable: the checker looks itself up via
    // `registry.artifacts.find(x => x.producer === skill && x.kind === 'report')`,
    // so exactly one such entry must exist per report-producing skill —
    // ambiguity here would make a checker pick the wrong reportFile silently.
    if (a.kind === 'report' && a.producerScript && a.file) {
      const matches = registry.artifacts.filter((x) => x.producer === a.producer && x.kind === 'report');
      expect(`registry: exactly one report artifact for producer "${a.producer}"`, matches.length === 1,
        `found ${matches.length}`);
    }
  }
}

// ---------- 6. Contract doc drift + version consistency ----------
{
  const r = runNode(path.join(root, 'scripts', 'gen-contract.mjs'), ['--check']);
  expect('docs/CONTRACT.md matches registry.json', r.status === 0, (r.stderr || '').trim());
  const version = read(path.join(root, registry.suiteVersionFile)).trim();
  const changelog = read(path.join(root, 'CHANGELOG.md'));
  expect(`CHANGELOG has an entry for VERSION (${version})`, changelog.includes(`## ${version}`));

  // The plugin manifest is a SECOND place the version is stated, and the two
  // are consumed by different audiences: `git describe` / CHANGELOG for people
  // reading the repo, plugin.json for `claude plugin list` on an installed
  // copy. Nothing forces them to agree, so a release that bumps one and not
  // the other ships a plugin that misreports which version it is.
  const manifest = JSON.parse(read(path.join(root, '.claude-plugin', 'plugin.json')));
  expect('plugin.json declares a version', typeof manifest.version === 'string' && manifest.version.length > 0,
    JSON.stringify(manifest.version));
  expect(`plugin.json version matches VERSION (${version})`, manifest.version === version,
    `plugin.json says ${manifest.version}`);

  // Valid semver, so `claude plugin` and any marketplace tooling can order
  // releases. Prerelease identifiers are dot-separated: 1.0.0-alpha.3 is
  // valid and sorts before 1.0.0; 1.0.0alpha3 is neither.
  const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  expect(`VERSION is valid semver (${version})`, SEMVER.test(version), version);
}

// ---------- 6b. ai-prose-slop patterns.md <-> Vale rule drift ----------
// No vale binary needed for this — it's pure text generation/diffing, so it
// runs unconditionally rather than being gated behind the vale-presence
// check in section 5.
{
  const r = runNode(path.join(root, 'ai-prose-slop', 'scripts', 'gen-patterns.mjs'), ['--check']);
  expect('ai-prose-slop/references/patterns.md matches rules/AIProseTells/*.yml', r.status === 0, (r.stderr || '').trim());
}

// ---------- 11. CI must live where GitHub will actually read it ----------
// GitHub Actions only reads workflows from <repo root>/.github/workflows. This
// suite's workflow previously sat at v2/.github/workflows/ci.yml — a path
// Actions never looks at — so it had never run once, and every CI change made
// against it (Windows matrix, vale PATH handling, gitleaks install) was inert.
// Nothing in the suite could detect that, because running the tests locally
// works identically either way.
//
// Resolved against the real git root rather than an assumed layout, so this
// keeps holding after v2/ is promoted to the repo root.
{
  let repoRoot = root;
  while (!fs.existsSync(path.join(repoRoot, '.git'))) {
    const parent = path.dirname(repoRoot);
    if (parent === repoRoot) { repoRoot = null; break; }
    repoRoot = parent;
  }
  if (repoRoot === null) {
    console.log('skip  CI-location test: not inside a git checkout');
  } else {
    const wfDir = path.join(repoRoot, '.github', 'workflows');
    const workflows = fs.existsSync(wfDir)
      ? fs.readdirSync(wfDir).filter((f) => /\.ya?ml$/.test(f))
      : [];
    const runners = workflows.filter((f) => read(path.join(wfDir, f)).includes('run-tests.mjs'));
    expect('a workflow at the git root runs this suite\'s tests',
      runners.length > 0,
      `no workflow in ${path.relative(repoRoot, wfDir)} references run-tests.mjs (found: ${workflows.join(', ') || 'none'})`);

    // A workflow nested inside the suite directory is the exact dead-file
    // shape this test exists to prevent — flag it rather than let a future
    // edit quietly recreate it.
    const nestedWfDir = path.join(root, '.github', 'workflows');
    const nestedIsReal = path.resolve(nestedWfDir) === path.resolve(wfDir);
    expect('no dead workflow nested inside the suite directory',
      nestedIsReal || !fs.existsSync(nestedWfDir),
      `${nestedWfDir} exists but GitHub Actions will never read it`);
  }
}
