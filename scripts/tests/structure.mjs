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
      // One SCRIPT, one report file. This is the invariant that actually
      // matters: a checker must be able to find its own report unambiguously.
      const sameScript = registry.artifacts.filter((x) => x.producerScript === a.producerScript && x.kind === 'report');
      expect(`registry: exactly one report artifact for script "${a.producerScript}"`,
        sameScript.length === 1, `found ${sameScript.length}`);

      // A skill MAY have several checkers (code-smells has a static one and a
      // git-history one), but then a by-producer lookup is ambiguous and would
      // silently pick whichever came first. Any script belonging to such a
      // skill must therefore select its report BY ID.
      const sameProducer = registry.artifacts.filter((x) => x.producer === a.producer && x.kind === 'report');
      if (sameProducer.length > 1) {
        const src = read(path.join(root, ...a.producerScript.split('/')));
        const byProducer = /\.producer\s*===\s*(skill|'|")/.test(src);
        const byId = new RegExp(`\\.id\\s*===\\s*['"]${a.id}['"]`).test(src);
        expect(`registry: "${a.producerScript}" selects its report by id (producer "${a.producer}" has ${sameProducer.length})`,
          byId && !byProducer,
          byProducer ? 'uses the ambiguous by-producer lookup' : 'no by-id lookup found');
      }
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

// ---------- 2c. Paths named in a SKILL.md must exist ----------
// Renaming templates/ -> assets/ across three skills broke nothing and the
// suite stayed green, which is the bug: a SKILL.md pointing at a file that
// does not exist is a dead instruction the model follows into a failure, and
// nothing here would have caught it.
//
// Only backtick-quoted, skill-relative paths with a known extension are
// checked — prose mentions and <this-skill> placeholders are not paths.
{
  const SUBDIRS = ['assets', 'references', 'scripts', 'templates'];
  const PATH_RE = /`((?:assets|references|scripts|templates)\/[A-Za-z0-9._\/-]+\.[A-Za-z0-9]+)`/g;
  let checked = 0;

  for (const skill of registry.skills.map((s) => s.id)) {
    const skillMd = path.join(root, skill, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    const text = read(skillMd);
    for (const m of text.matchAll(PATH_RE)) {
      const rel = m[1];
      checked++;
      // Resolve against the skill OR the repo root: testing-strategy cites
      // "this suite's own `scripts/run-tests.mjs`" as a worked example, which
      // is a real path, just not a skill-relative one. Accepting both keeps
      // the check honest (the file must exist somewhere) without banning a
      // legitimate way to reference the repo itself.
      const found = fs.existsSync(path.join(root, skill, ...rel.split('/')))
        || fs.existsSync(path.join(root, ...rel.split('/')));
      expect(`${skill}: SKILL.md path ${rel} exists`, found, 'referenced but missing');
    }
    // templates/ is the pre-canonical name for assets/ (Anthropic's skill
    // convention: scripts/ = executable, references/ = read for context,
    // assets/ = used in output). Pin the rename so it cannot drift back.
    expect(`${skill}: uses assets/ not templates/`, !fs.existsSync(path.join(root, skill, 'templates')),
      'templates/ present — canonical name is assets/');
    // Guard against a fourth convention appearing by accident. One documented
    // exception: ai-prose-slop/rules/ is Vale's StylesPath layout, whose shape
    // the tool dictates — renaming it to assets/ would simply stop Vale
    // finding the styles.
    const EXCEPTIONS = { 'ai-prose-slop': ['rules'] };
    const allowed = SUBDIRS.concat(EXCEPTIONS[skill] || []);
    for (const e of fs.readdirSync(path.join(root, skill), { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      expect(`${skill}: subdir ${e.name} is a canonical one`, allowed.includes(e.name),
        `unexpected dir (canonical: ${SUBDIRS.filter((s) => s !== 'templates').join(', ')})`);
    }
  }
  expect('SKILL.md path references were actually found and checked', checked > 0, `${checked} found`);
}

// ---------- 2d. Cross-tool agent entrypoints ----------
// AGENTS.md is the tool-agnostic source; CLAUDE.md exists only because Claude
// Code looks for that name. The failure this pins is duplication: the moment
// CLAUDE.md grows rules of its own, the two drift and whichever file a given
// tool reads decides which version is true.
{
  const agentsMd = path.join(root, 'AGENTS.md');
  const claudeMd = path.join(root, 'CLAUDE.md');

  expect('AGENTS.md exists (tool-agnostic entrypoint)', fs.existsSync(agentsMd));
  expect('CLAUDE.md exists (Claude Code looks for this name)', fs.existsSync(claudeMd));

  if (fs.existsSync(claudeMd)) {
    const claude = read(claudeMd);
    expect('CLAUDE.md points at AGENTS.md', /AGENTS\.md/.test(claude), 'no reference');
    // A pointer, not a second rulebook. Kept short deliberately: length here
    // is the symptom of guidance leaking back in.
    expect('CLAUDE.md stays a pointer, not a second copy of the rules',
      claude.split('\n').filter((l) => l.trim()).length <= 12,
      `${claude.split('\n').filter((l) => l.trim()).length} non-blank lines`);
  }

  if (fs.existsSync(agentsMd)) {
    const agents = read(agentsMd);
    // Must reference the style rules rather than restate them, for the same
    // single-source reason.
    expect('AGENTS.md references the shared response style',
      /output-style\/concise\.md/.test(agents), 'no reference');
    // Any repo-relative path AGENTS.md names must resolve — the same dead-link
    // failure the SKILL.md check above exists for.
    for (const m of agents.matchAll(/\]\(\.\/([A-Za-z0-9._\/-]+\.[A-Za-z0-9]+)\)/g)) {
      expect(`AGENTS.md link ./${m[1]} resolves`,
        fs.existsSync(path.join(root, ...m[1].split('/'))), 'referenced but missing');
    }
  }

  // The portability table in INSTALL.md claims skills install to every
  // harness in registry.json. If a harness is added there and the table is
  // not updated, the docs quietly overstate coverage.
  const install = read(path.join(root, 'INSTALL.md'));
  for (const harness of Object.keys(registry.harnessPaths)) {
    expect(`INSTALL.md portability table mentions harness "${harness}"`,
      new RegExp(harness, 'i').test(install), 'harness in registry but absent from docs');
  }
}

// ---------- 2e. plugin.json <-> registry <-> marketplace ----------
// The manifest's skills array was cross-checked against nothing. A skill added
// to registry.json AND the filesystem but never appended here would pass every
// fixture, schema and registry test — and then simply not load for anyone who
// installed the plugin. The two lists matched by inspection, not by
// construction. Same drift class as VERSION vs plugin.json version, which is
// already pinned; this side was not. Found by audit, 2026-08-02.
{
  const manifest = JSON.parse(read(path.join(root, '.claude-plugin', 'plugin.json')));
  const declared = (manifest.skills || []).map((s) => s.replace(/^\.\//, ''));
  const registered = registry.skills.map((s) => s.id);

  const missingFromManifest = registered.filter((id) => !declared.includes(id));
  expect('plugin.json declares every registered skill',
    missingFromManifest.length === 0,
    `registered but not shipped: ${missingFromManifest.join(', ')}`);

  const extraInManifest = declared.filter((id) => !registered.includes(id));
  expect('plugin.json declares no skill absent from the registry',
    extraInManifest.length === 0,
    `shipped but not registered: ${extraInManifest.join(', ')}`);

  // Each declared path must actually contain a skill, or the plugin ships a
  // dangling entry that fails at load time rather than here.
  for (const id of declared) {
    expect(`plugin.json path ./${id} contains a SKILL.md`,
      fs.existsSync(path.join(root, id, 'SKILL.md')), 'declared but missing on disk');
  }

  // The marketplace is the other file a user's install actually reads, and
  // nothing validated it at all.
  const market = JSON.parse(read(path.join(root, '.claude-plugin', 'marketplace.json')));
  expect('marketplace.json lists at least one plugin',
    Array.isArray(market.plugins) && market.plugins.length > 0, JSON.stringify(market.plugins));
  for (const p of market.plugins || []) {
    const src = String(p.source || '').replace(/^\.\//, '') || '.';
    const manifestPath = src === '.' || src === ''
      ? path.join(root, '.claude-plugin', 'plugin.json')
      : path.join(root, src, '.claude-plugin', 'plugin.json');
    expect(`marketplace entry "${p.name}" resolves to a plugin.json`,
      fs.existsSync(manifestPath), manifestPath);
    if (!fs.existsSync(manifestPath)) continue;
    const m = JSON.parse(read(manifestPath));
    expect(`marketplace entry "${p.name}" matches that manifest's own name`,
      m.name === p.name, `marketplace says ${p.name}, manifest says ${m.name}`);
  }
}
