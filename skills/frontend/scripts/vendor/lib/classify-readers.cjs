'use strict';

// Per-ecosystem manifest readers for classify.cjs, split out on 2026-09-03
// when classify.cjs reached 553 lines against the 400-line rule check-smells
// enforces on every project this suite is pointed at — the self-assessment
// found the suite failing its own checker on its own core file.
//
// Each reader returns { manifestFile, depNames: Set<string> } or null if the
// ecosystem's manifest isn't present. depNames are lowercased for
// case-insensitive matching against the framework/ORM lists in classify.cjs.
// None is a full parser for its ecosystem's config language (no real
// TOML/XML/Gradle-DSL grammar); each extracts a flat set of declared
// dependency names and documents where that approximation bites.

const fs = require('fs');
const path = require('path');

function readFileIfExists(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

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

// Finds every package.json in the tree, not just the root one. A common
// non-monorepo-tool layout — backend/package.json + frontend/package.json,
// no npm/yarn `workspaces` field tying them together — previously read as
// "no server, no frontend deps" because only the root manifest was ever
// consulted: express in backend/package.json and react in
// frontend/package.json were both invisible, so a genuinely multi-part
// project classified as single-part. `rel` is already the full, SKIP_DIRS-
// filtered (node_modules excluded) file walk `classify()` performs, so this
// costs no extra directory traversal.
function findAllNodeManifests(root, rel) {
  const found = [];
  for (const r of rel) {
    if (!/(^|\/)package\.json$/.test(r)) continue;
    const text = readFileIfExists(path.join(root, r));
    if (text === null) continue;
    let pkg;
    try {
      pkg = JSON.parse(text);
    } catch {
      continue;
    }
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    found.push({ ecosystem: 'node', manifestFile: r, depNames: new Set(Object.keys(deps).map((d) => d.toLowerCase())), pkg });
  }
  return found;
}

const MANIFEST_NAMES = {
  python: new Set(['requirements.txt', 'pyproject.toml']),
  go: new Set(['go.mod']),
  ruby: new Set(['Gemfile']),
  java: new Set(['pom.xml', 'build.gradle', 'build.gradle.kts']),
  rust: new Set(['Cargo.toml']),
  php: new Set(['composer.json']),
};

function findAllNonNodeManifests(root, rel) {
  const found = [];
  for (const [ecosystem, names] of Object.entries(MANIFEST_NAMES)) {
    const dirs = new Set();
    for (const file of rel) {
      if (names.has(path.posix.basename(file))) {
        const dir = path.posix.dirname(file);
        dirs.add(dir === '.' ? '' : dir);
      }
    }
    for (const dir of dirs) {
      const manifestRoot = path.join(root, ...dir.split('/').filter(Boolean));
      const item = ECOSYSTEM_READERS[ecosystem](manifestRoot);
      if (!item) continue;
      const manifestFile = item.manifestFile.split(' + ')
        .map((name) => dir ? `${dir}/${name}` : name).join(' + ');
      found.push({ ecosystem, ...item, manifestFile });
    }
  }
  return found;
}

// requirements.txt: one requirement per line ("Django==4.2", "flask>=2.0",
// "# comment", "-e git+..." editable installs skipped). pyproject.toml:
// supports the two common shapes — PEP 621's `[project] dependencies = [...]`
// array, and Poetry's `[tool.poetry.dependencies]` table — extracted with a
// line-scan, not a real TOML parser (documented limit: an inline table or
// unusual formatting inside these blocks may not be caught).
// Reads a requirements.txt, following `-r other.txt` / `--requirement other.txt`
// includes (the split requirements/base.txt layout is extremely common, and not
// following it previously yielded ZERO dependencies for the whole project).
// Depth- and cycle-bounded; other flag lines (--extra-index-url, -e) are skipped.
function readRequirements(file, names, seen, depth = 0) {
  if (depth > 8 || seen.has(file)) return false;
  seen.add(file);
  const text = readFileIfExists(file);
  if (text === null) return false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const include = line.match(/^(?:-r|--requirement)[=\s]+(\S+)/);
    if (include) {
      readRequirements(path.resolve(path.dirname(file), include[1]), names, seen, depth + 1);
      continue;
    }
    if (line.startsWith('-')) continue; // some other pip flag
    const m = line.match(/^([A-Za-z0-9_.-]+)/);
    if (m) names.add(m[1].toLowerCase());
  }
  return true;
}

// Extracts the body of a TOML array by matching brackets from `key = [`, so a
// single-line `dependencies = ["flask"]` works and state cannot leak past the
// closing `]` into an unrelated array (a `classifiers = [...]` list following
// `dependencies` was previously scraped as if it held dependencies).
function tomlArrayBody(text, key) {
  const start = text.search(new RegExp(`^\\s*${key}\\s*=\\s*\\[`, 'm'));
  if (start === -1) return null;
  const open = text.indexOf('[', start);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

function readPython(root) {
  const names = new Set();
  const manifestsFound = [];

  const reqPath = path.join(root, 'requirements.txt');
  if (readRequirements(reqPath, names, new Set())) manifestsFound.push('requirements.txt');

  const pyprojectText = readFileIfExists(path.join(root, 'pyproject.toml'));
  if (pyprojectText !== null) {
    manifestsFound.push('pyproject.toml');
    // PEP 621: [project] dependencies = [...]
    const body = tomlArrayBody(pyprojectText, 'dependencies');
    if (body !== null) {
      for (const m of body.matchAll(/["']\s*([A-Za-z0-9_.-]+)/g)) names.add(m[1].toLowerCase());
    }
    // Poetry, including 1.2+ group tables:
    // [tool.poetry.dependencies], [tool.poetry.dev-dependencies],
    // [tool.poetry.group.<name>.dependencies]
    let inPoetryDeps = false;
    for (const rawLine of pyprojectText.split('\n')) {
      const line = rawLine.trim();
      if (line.startsWith('[')) {
        inPoetryDeps = /^\[tool\.poetry\.(dependencies|dev-dependencies|group\.[A-Za-z0-9_.-]+\.dependencies)\]/.test(line);
        continue;
      }
      if (!inPoetryDeps) continue;
      const m = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
      if (m && m[1].toLowerCase() !== 'python') names.add(m[1].toLowerCase());
    }
  }

  return manifestsFound.length > 0
    ? { manifestFile: manifestsFound.join(' + '), depNames: names }
    : null;
}

// go.mod: module paths inside a `require ( ... )` block or on a single-line
// `require module/path vX.Y.Z`. Matched by full module path (e.g.
// "github.com/gin-gonic/gin"), not a short name — Go has no package-name
// registry separate from its import path.
// Line-based rather than a regex over the whole file. The previous
// `/require\s*\(([\s\S]*?)\)/` was non-global (only the FIRST require block was
// read — multiple blocks are normal `go mod tidy` output) and lazy (a `)` inside
// a comment truncated the block, dropping every dep after it). Both produced
// zero deps on ordinary files. `// indirect` requirements are transitive, not
// chosen by the author, so counting them caused false dual-ORM findings.
function readGo(root) {
  const text = readFileIfExists(path.join(root, 'go.mod'));
  if (text === null) return null;
  const names = new Set();
  let inBlock = false;
  for (const rawLine of text.split('\n')) {
    const isIndirect = /\/\/\s*indirect\b/.test(rawLine);
    const line = rawLine.replace(/\/\/.*$/, '').trim(); // strip comment, keep the code
    if (!line) continue;
    if (!inBlock) {
      if (/^require\s*\($/.test(line)) { inBlock = true; continue; }
      const inline = line.match(/^require\s*\(?\s*(\S+)\s+v\S+\s*\)?$/);
      if (inline && !isIndirect) names.add(inline[1].toLowerCase());
      continue;
    }
    if (line === ')') { inBlock = false; continue; }
    const m = line.match(/^(\S+)\s+v\S+/);
    if (m && !isIndirect) names.add(m[1].toLowerCase());
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
    // Only artifactIds inside a <dependency>, and NOT inside its <exclusions>.
    // Matching every <artifactId> in the document counted the project's own
    // name, parent POMs, build plugins, and — worst — excluded artifacts: a
    // textbook Spring Boot pom that EXCLUDES hibernate-core was read as
    // DEPENDING on it, producing a false dual-ORM BLOCK.
    for (const dep of pomText.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
      const withoutExclusions = dep[1].replace(/<exclusions>[\s\S]*?<\/exclusions>/g, '');
      const id = withoutExclusions.match(/<artifactId>([^<]+)<\/artifactId>/);
      if (id) names.add(id[1].trim().toLowerCase());
    }
  }
  for (const gradleFile of ['build.gradle', 'build.gradle.kts']) {
    const text = readFileIfExists(path.join(root, gradleFile));
    if (text === null) continue;
    manifestFile = manifestFile || gradleFile;
    // The version segment is OPTIONAL: under a BOM or the Spring dependency
    // management plugin, `implementation 'group:artifact'` with no version is
    // the normal form, and requiring `:version` made a standard Spring Boot
    // Gradle app read as having no dependencies at all.
    for (const m of text.matchAll(/['"]([a-zA-Z0-9._-]+):([a-zA-Z0-9._-]+)(?::[^'"]*)?['"]/g)) {
      names.add(m[2].toLowerCase());
    }
  }
  return manifestFile ? { manifestFile, depNames: names } : null;
}

// Cargo.toml: crate names as keys inside a dependency table, either
// `name = "1.0"` or `name = { version = "1.0", ... }`.
//
// Also handles the two forms that previously yielded nothing:
//   [dependencies.axum]        — the per-crate subtable form, used whenever a
//                                crate needs `features`. It matched the generic
//                                `^\[` section-exit test, so it not only missed
//                                axum but switched parsing OFF for the rest of
//                                the file.
//   [workspace.dependencies]   — where a Cargo workspace root declares ALL
//                                shared deps (members then write
//                                `axum.workspace = true`).
const RUST_DEP_TABLE = /^\[(?:workspace\.)?(?:dependencies|dev-dependencies|build-dependencies)(?:\.([A-Za-z0-9_-]+))?\]/;

function readRust(root) {
  const text = readFileIfExists(path.join(root, 'Cargo.toml'));
  if (text === null) return null;
  const names = new Set();
  let inDeps = false;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const table = line.match(RUST_DEP_TABLE);
    if (table) {
      // `[dependencies.axum]` names the crate in the header itself; the keys
      // inside it are that crate's settings, not further dependencies.
      if (table[1]) { names.add(table[1].toLowerCase()); inDeps = false; } else { inDeps = true; }
      continue;
    }
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

module.exports = { findAllNodeManifests, findAllNonNodeManifests };
