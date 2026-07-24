'use strict';

// The ONE project classifier. Every checker and the acceptance gate use this
// — no per-skill re-derivation of scope, so gates can't disagree about what
// kind of project they're looking at (v0.4 had four competing heuristics).
//
// Manifest detection covers seven ecosystems (Node, Python, Go, Ruby, Java,
// Rust, PHP) — not Node only. A Django/Flask, Gin/Echo, Rails, Spring Boot,
// Actix/Rocket, or Laravel/Symfony backend must be recognized as
// `serverPresent` the same way an Express app is; before this, every
// non-Node backend silently read as "no server detected" and every check
// gated on it (B-scope, P-scope via multiPart) skipped entirely. Each
// ecosystem's manifest parser is deliberately NOT a full parser for that
// ecosystem's config language (no real TOML/XML/Gradle-DSL grammar) — it
// extracts a flat set of declared dependency names, documented as an
// approximation where it is one, the same tradeoff this suite already
// accepts for package.json-adjacent tooling (see gen-patterns.mjs's
// parseSimpleYaml for the precedent).

const fs = require('fs');
const path = require('path');

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.svelte-kit', 'vendor', 'target', '.venv', 'venv', '__pycache__', 'bin', 'obj',
]);

// Files this large are almost never source; skip them rather than risk an
// OOM on a committed binary or data dump that happens to match a scanned
// extension. Skipped files are recorded so callers can report the gap
// instead of silently treating "not read" as "clean".
const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Hard cap on total files walked — a safety valve against pathological
// trees, not a normal-project limit (SKIP_DIRS already excludes the big
// generated directories). Exceeding it means the classification is
// incomplete, which callers should treat as evidence of that, not silence.
const MAX_FILES = 50000;

// Shared arch-doc candidate list — previously duplicated and drifted between
// checkers, producing contradictory verdicts on case-sensitive filesystems.
const ARCH_DOC_CANDIDATES = [
  'ARCHITECTURE.md',
  'architecture.md',
  path.join('docs', 'ARCHITECTURE.md'),
  path.join('docs', 'architecture.md'),
];

function readFileIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

// ---------- Per-ecosystem manifest readers ----------
// Each returns { manifestFile, depNames: Set<string> } or null if the
// ecosystem's manifest isn't present. depNames are lowercased for
// case-insensitive matching against the framework/ORM lists below.

function readNode(root) {
  const text = readFileIfExists(path.join(root, 'package.json'));
  if (text === null) return null;
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    return null;
  }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return { manifestFile: 'package.json', depNames: new Set(Object.keys(deps).map((d) => d.toLowerCase())), pkg };
}

// requirements.txt: one requirement per line ("Django==4.2", "flask>=2.0",
// "# comment", "-e git+..." editable installs skipped). pyproject.toml:
// supports the two common shapes — PEP 621's `[project] dependencies = [...]`
// array, and Poetry's `[tool.poetry.dependencies]` table — extracted with a
// line-scan, not a real TOML parser (documented limit: an inline table or
// unusual formatting inside these blocks may not be caught).
function readPython(root) {
  const names = new Set();
  let found = false;
  const reqText = readFileIfExists(path.join(root, 'requirements.txt'));
  if (reqText !== null) {
    found = true;
    for (const rawLine of reqText.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('-')) continue;
      const m = line.match(/^([A-Za-z0-9_.-]+)/);
      if (m) names.add(m[1].toLowerCase());
    }
  }
  const pyprojectText = readFileIfExists(path.join(root, 'pyproject.toml'));
  if (pyprojectText !== null) {
    found = true;
    const lines = pyprojectText.split('\n');
    let inPep621Deps = false;
    let inPoetryDeps = false;
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (/^\[tool\.poetry\.(dependencies|dev-dependencies)\]/.test(line)) { inPoetryDeps = true; inPep621Deps = false; continue; }
      if (/^dependencies\s*=\s*\[/.test(line)) { inPep621Deps = true; inPoetryDeps = false; continue; }
      if (/^\[/.test(line)) { inPoetryDeps = false; inPep621Deps = false; continue; }
      if (inPep621Deps) {
        const m = line.match(/^["']([A-Za-z0-9_.-]+)/);
        if (m) names.add(m[1].toLowerCase());
      } else if (inPoetryDeps) {
        const m = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
        if (m && m[1].toLowerCase() !== 'python') names.add(m[1].toLowerCase());
      }
    }
  }
  return found ? { manifestFile: reqText !== null ? 'requirements.txt' : 'pyproject.toml', depNames: names } : null;
}

// go.mod: module paths inside a `require ( ... )` block or on a single-line
// `require module/path vX.Y.Z`. Matched by full module path (e.g.
// "github.com/gin-gonic/gin"), not a short name — Go has no package-name
// registry separate from its import path.
function readGo(root) {
  const text = readFileIfExists(path.join(root, 'go.mod'));
  if (text === null) return null;
  const names = new Set();
  const blockMatch = text.match(/require\s*\(([\s\S]*?)\)/);
  if (blockMatch) {
    for (const rawLine of blockMatch[1].split('\n')) {
      const m = rawLine.trim().match(/^(\S+)\s+v\S+/);
      if (m) names.add(m[1].toLowerCase());
    }
  }
  for (const m of text.matchAll(/^require\s+(\S+)\s+v\S+/gm)) {
    names.add(m[1].toLowerCase());
  }
  return { manifestFile: 'go.mod', depNames: names };
}

// Gemfile: `gem 'name'` / `gem "name", "~> 1.0"` calls, one per line in the
// overwhelming common case (a multi-gem-per-line Gemfile is not supported).
function readRuby(root) {
  const text = readFileIfExists(path.join(root, 'Gemfile'));
  if (text === null) return null;
  const names = new Set();
  for (const m of text.matchAll(/^\s*gem\s+['"]([^'"]+)['"]/gm)) {
    names.add(m[1].toLowerCase());
  }
  return { manifestFile: 'Gemfile', depNames: names };
}

// pom.xml: <artifactId>name</artifactId> values (a real XML parser is
// overkill for extracting one tag's text content; a stray commented-out
// dependency block would be a false positive this accepts as a known
// limit). build.gradle/build.gradle.kts: `<configuration> 'group:artifact:version'`
// or `("group:artifact:version")` — the artifact segment is extracted.
function readJava(root) {
  const names = new Set();
  let manifestFile = null;
  const pomText = readFileIfExists(path.join(root, 'pom.xml'));
  if (pomText !== null) {
    manifestFile = 'pom.xml';
    for (const m of pomText.matchAll(/<artifactId>([^<]+)<\/artifactId>/g)) {
      names.add(m[1].trim().toLowerCase());
    }
  }
  for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
    const text = readFileIfExists(path.join(root, gradleFile));
    if (text === null) continue;
    manifestFile = manifestFile || gradleFile;
    for (const m of text.matchAll(/['"(]([a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+):[^'")]+['")]/g)) {
      const artifact = m[1].split(':')[1];
      if (artifact) names.add(artifact.toLowerCase());
    }
  }
  return manifestFile ? { manifestFile, depNames: names } : null;
}

// Cargo.toml: crate names as keys inside a `[dependencies]` (or
// `[dev-dependencies]`) table, either `name = "1.0"` or `name = { version = "1.0", ... }`.
function readRust(root) {
  const text = readFileIfExists(path.join(root, 'Cargo.toml'));
  if (text === null) return null;
  const names = new Set();
  let inDeps = false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (/^\[(dependencies|dev-dependencies|build-dependencies)\]/.test(line)) { inDeps = true; continue; }
    if (/^\[/.test(line)) { inDeps = false; continue; }
    if (inDeps) {
      const m = line.match(/^([a-zA-Z0-9_-]+)\s*=/);
      if (m) names.add(m[1].toLowerCase());
    }
  }
  return { manifestFile: 'Cargo.toml', depNames: names };
}

function readPhp(root) {
  const text = readFileIfExists(path.join(root, 'composer.json'));
  if (text === null) return null;
  let pkg;
  try {
    pkg = JSON.parse(text);
  } catch {
    return { manifestFile: 'composer.json', depNames: new Set() };
  }
  const deps = { ...(pkg.require || {}), ...(pkg['require-dev'] || {}) };
  return { manifestFile: 'composer.json', depNames: new Set(Object.keys(deps).map((d) => d.toLowerCase())) };
}

const ECOSYSTEM_READERS = {
  node: readNode,
  python: readPython,
  go: readGo,
  ruby: readRuby,
  java: readJava,
  rust: readRust,
  php: readPhp,
};

// Server framework deps per ecosystem, split the same way Node's always
// was: STANDALONE means a genuinely separate deployable (implies
// multi-part when paired with a frontend); FULLSTACK means the framework
// runs server code AND typically renders its own UI in one deployable
// (Django, Rails: backend laws still apply, but it's not automatically
// multi-part the way a distinct API service + separate frontend is).
const SERVER_FRAMEWORKS = {
  node: { standalone: ['express', 'fastify', 'koa', 'hono', '@nestjs/core'], fullstack: ['next'] },
  python: { standalone: ['flask', 'fastapi', 'tornado', 'aiohttp', 'pyramid', 'bottle'], fullstack: ['django'] },
  go: {
    standalone: ['github.com/gin-gonic/gin', 'github.com/labstack/echo/v4', 'github.com/gofiber/fiber/v2', 'github.com/go-chi/chi/v5', 'github.com/gorilla/mux'],
    fullstack: [],
  },
  ruby: { standalone: ['sinatra', 'grape', 'hanami'], fullstack: ['rails'] },
  java: { standalone: ['micronaut', 'quarkus-core'], fullstack: ['spring-boot-starter-web'] },
  rust: { standalone: ['actix-web', 'rocket', 'axum', 'warp'], fullstack: [] },
  php: { standalone: ['slim/slim'], fullstack: ['laravel/framework', 'symfony/symfony'] },
};

// ORM/data-layer deps per ecosystem, for backend-engineering's dual-ORM
// check. A fullstack framework that bundles its own ORM (Django, Rails) is
// listed here too — using it ALONGSIDE a second ORM in the same manifest is
// exactly the dual-ORM smell, even though the framework itself isn't a
// separate "ORM package" a developer explicitly chose.
const ORM_DEPS = {
  node: ['prisma', '@prisma/client', 'typeorm', 'sequelize', 'mongoose', 'knex', 'drizzle-orm'],
  python: ['sqlalchemy', 'django', 'peewee', 'tortoise-orm'],
  go: ['gorm.io/gorm', 'entgo.io/ent'],
  ruby: ['rails', 'activerecord', 'sequel'],
  java: ['hibernate-core', 'spring-boot-starter-data-jpa', 'mybatis'],
  rust: ['diesel', 'sea-orm', 'sqlx'],
  php: ['laravel/framework', 'illuminate/database', 'doctrine/orm'],
};

const FRONTEND_DEPS = ['react', 'vue', 'svelte', '@angular/core', 'solid-js', 'preact', 'next'];

function listFiles(root, evidenceDirName) {
  const out = [];
  let truncated = false;
  function walk(dir) {
    if (out.length >= MAX_FILES) {
      truncated = true;
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || e.name === evidenceDirName) continue;
        walk(path.join(dir, e.name));
      } else {
        out.push(path.join(dir, e.name));
        if (out.length >= MAX_FILES) {
          truncated = true;
          return;
        }
      }
    }
  }
  walk(root);
  return { files: out, truncated };
}

// Safe read: skips files above MAX_FILE_BYTES (returns null, distinct from
// "" so callers don't mistake "skipped" for "empty and clean").
function readFileSafe(absPath) {
  try {
    const stat = fs.statSync(absPath);
    if (stat.size > MAX_FILE_BYTES) return null;
    return fs.readFileSync(absPath, 'utf8');
  } catch {
    return null;
  }
}

// listFiles swallows readdirSync errors by design (an unreadable SUBdirectory
// shouldn't abort a whole scan). Applied to the root itself that turned a
// nonexistent path into "zero files found" -> "not applicable" -> pass -> SHIP,
// so a typo'd --root in CI was indistinguishable from a clean codebase. The
// root specifically must be proven readable before any verdict is computed:
// "I scanned it and found nothing" and "I could not scan it" are different
// claims, and only the first may pass.
function assertReadableRoot(root) {
  let stat;
  try {
    stat = fs.statSync(root);
  } catch (e) {
    throw new Error(
      `--root is not readable: ${root} (${e.code || e.message}). ` +
      `Refusing to report a verdict on a directory that could not be scanned.`
    );
  }
  if (!stat.isDirectory()) {
    throw new Error(`--root is not a directory: ${root}`);
  }
}

function classify(root, opts = {}) {
  const evidenceDirName = opts.evidenceDir || '.agent-evidence';
  assertReadableRoot(root);
  const { files, truncated } = listFiles(root, evidenceDirName);
  // IMPORTANT: all signal matching happens on paths RELATIVE to root — the
  // absolute location of the checkout must never change a verdict.
  const rel = files.map((f) => path.relative(root, f).split(path.sep).join('/'));

  const manifests = [];
  for (const [ecosystem, reader] of Object.entries(ECOSYSTEM_READERS)) {
    const found = reader(root);
    if (found) manifests.push({ ecosystem, ...found });
  }
  // Back-compat: `pkg`/`deps` are the Node manifest specifically (several
  // checkers pre-date multi-ecosystem support and only ever meant Node's).
  const nodeManifest = manifests.find((m) => m.ecosystem === 'node');
  const pkg = nodeManifest ? nodeManifest.pkg : null;
  const deps = nodeManifest ? Object.fromEntries([...nodeManifest.depNames].map((d) => [d, true])) : {};

  const explicitServerFile =
    rel.some((f) => /^(server|api)\.(c|m)?js$/.test(f) || /^(server|api)\/.+\.(c|m)?(j|t)s$/.test(f));
  const standaloneServerDep = manifests.some((m) => (SERVER_FRAMEWORKS[m.ecosystem]?.standalone || []).some((d) => m.depNames.has(d.toLowerCase())));
  const fullstackFrameworkDep = manifests.some((m) => (SERVER_FRAMEWORKS[m.ecosystem]?.fullstack || []).some((d) => m.depNames.has(d.toLowerCase())));

  // serverPresent: server code exists and backend laws (secrets, ORM) apply.
  const serverPresent = explicitServerFile || standaloneServerDep || fullstackFrameworkDep;
  // distinctServerPresent: server code lives in a deployable separate from
  // the frontend — the signal multi-part boundary decisions should key on.
  const distinctServerPresent = explicitServerFile || standaloneServerDep;

  const frontendPresent =
    rel.some((f) => /(^|\/)index\.html$/.test(f) || /^public\//.test(f) || /\.(jsx|tsx|vue|svelte)$/.test(f)) ||
    (nodeManifest ? FRONTEND_DEPS.some((d) => nodeManifest.depNames.has(d)) : false);

  // Multi-part means real trust boundaries: a distinct server plus a
  // frontend, or an explicit workspace split. A bare go.mod/Cargo.toml does
  // NOT make a library "multi" on its own — only a standalone SERVER
  // framework dependency (Gin, Rails, Actix, ...) does, same rule as Node.
  const multiPart =
    (distinctServerPresent && frontendPresent) ||
    Boolean(pkg && Array.isArray(pkg.workspaces) && pkg.workspaces.length > 1);

  let archDocPath = null;
  for (const cand of ARCH_DOC_CANDIDATES) {
    if (fs.existsSync(path.join(root, cand))) {
      archDocPath = cand.split(path.sep).join('/');
      break;
    }
  }

  return {
    root, files, rel, pkg, deps, manifests,
    serverPresent, distinctServerPresent, frontendPresent, multiPart, archDocPath, truncated,
    readFileSafe: (i) => readFileSafe(files[i]),
  };
}

// requiredWhen conditions used by registry.json artifacts.
function conditionMet(condition, cls) {
  switch (condition) {
    case 'always': return true;
    case 'never': return false;
    case 'multi_part': return cls.multiPart;
    case 'server_present': return cls.serverPresent;
    case 'frontend_present': return cls.frontendPresent;
    default:
      throw new Error(`Unknown requiredWhen condition "${condition}" — add it to classify.cjs`);
  }
}

const KNOWN_REQUIRED_WHEN = ['always', 'never', 'multi_part', 'server_present', 'frontend_present'];

module.exports = {
  classify, conditionMet, listFiles, readFileSafe, assertReadableRoot, ARCH_DOC_CANDIDATES, KNOWN_REQUIRED_WHEN, MAX_FILE_BYTES,
  ORM_DEPS, SERVER_FRAMEWORKS,
};
