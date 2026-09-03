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

// An agent tool's own working directory is not part of the project it is
// working on. `.claude/worktrees/<branch>/` in particular holds a FULL COPY
// of the tree — verified on a real project here: a single-part Express app
// with one worktree under .claude/ classified as multiPart, because the
// worktree's package.json counted as a second part, and check-architecture
// then BLOCKed demanding an ARCHITECTURE.md for a project with one part.
// Every checker that walks a tree needs this set, so it is exported rather
// than restated; scripts/tests/structure.mjs fails if a copy drifts.
const AGENT_TOOL_DIRS = ['.claude', '.cursor', '.codex', '.agents', '.aider', '.worktrees'];

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.next', '.svelte-kit', 'vendor', 'target', '.venv', 'venv', '__pycache__', 'bin', 'obj',
  'fixtures', 'testdata', 'examples', 'eval',
  ...AGENT_TOOL_DIRS,
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

// The per-ecosystem manifest readers live in classify-readers.cjs; this file
// keeps the classification itself.
const { findAllNodeManifests, findAllNonNodeManifests } = require('./classify-readers.cjs');

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

  const manifests = [
    ...findAllNonNodeManifests(root, rel),
    ...findAllNodeManifests(root, rel),
  ];
  // Back-compat: `pkg`/`deps` are the ROOT Node manifest specifically
  // (several checkers pre-date multi-ecosystem support and only ever meant
  // Node's) — not just any node-ecosystem entry, now that nested
  // backend/package.json-style manifests are also collected above.
  const nodeManifest = manifests.find((m) => m.ecosystem === 'node' && m.manifestFile === 'package.json');
  const pkg = nodeManifest ? nodeManifest.pkg : null;
  const deps = nodeManifest ? Object.fromEntries([...nodeManifest.depNames].map((d) => [d, true])) : {};

  // The file-form pattern previously omitted `t`, so a root `server.ts` was not
  // a server signal while `api/index.ts` was — and check-backend.js's own
  // SERVER_ONLY_PATTERNS lists `src/server.ts` as server-only, so the two files
  // disagreed about what a server file is. Now matched at any depth, both
  // extensions, consistent with that deny-list.
  const explicitServerFile =
    rel.some((f) => /(^|\/)(server|api)\.(c|m)?[jt]s$/.test(f) || /(^|\/)(server|api)\/.+\.(c|m)?[jt]s$/.test(f));
  const standaloneServerDep = manifests.some((m) => (SERVER_FRAMEWORKS[m.ecosystem]?.standalone || []).some((d) => m.depNames.has(d.toLowerCase())));
  const fullstackFrameworkDep = manifests.some((m) => (SERVER_FRAMEWORKS[m.ecosystem]?.fullstack || []).some((d) => m.depNames.has(d.toLowerCase())));

  // serverPresent: server code exists and backend laws (secrets, ORM) apply.
  const serverPresent = explicitServerFile || standaloneServerDep || fullstackFrameworkDep;
  // distinctServerPresent: server code lives in a deployable separate from
  // the frontend — the signal multi-part boundary decisions should key on.
  const distinctServerPresent = explicitServerFile || standaloneServerDep;

  const frontendPresent =
    rel.some((f) => /(^|\/)index\.html$/.test(f) || /^public\//.test(f) || /\.(jsx|tsx|vue|svelte)$/.test(f)) ||
    manifests.some((m) => m.ecosystem === 'node' && FRONTEND_DEPS.some((d) => m.depNames.has(d)));

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
  AGENT_TOOL_DIRS,
  ORM_DEPS, SERVER_FRAMEWORKS, findAllNonNodeManifests,
};
