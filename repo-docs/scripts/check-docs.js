#!/usr/bin/env node
'use strict';
// Does this repository's documentation read as professional, and is it
// shaped the way a reader expects?
//
// The voice and ASD-STE100 rules are Vale styles in ../rules, run through
// vale-docs.cjs, so an editor with the Vale extension shows the same findings
// while the document is written. A prose linter alone was not enough before:
// Vale passed every draft of one set of release notes and one README that a
// person then rejected line by line, because no style had rules for those
// habits. These styles do.
//
// What Vale cannot express stays here: whether a README says what the project
// is and has the sections its type needs, whether ADRs carry every required
// section, whether release notes quote only figures the changelog recorded,
// and the stricter word limit for a numbered step, which needs to tell an
// ordered list from a bullet.
//
// Usage: node check-docs.js --root <dir> [--files a.md,b.md | --files-from <list>]
//                           [--release-notes <file> [--section <name>] [--changelog <file>]]
//                           [--strict] [--out <file>] [--no-write] [--format text|json]
//
// .docs-style.json turns rules off ({ "disable": ["D-connectives"] }) and the
// opt-in STE profile on ({ "profile": "ste", "dictionary": "<file>" }).

const path = require('path');
const fs = require('fs');
const os = require('os');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { check, runCli, readText, sectionHasContent } = require(path.join(core.lib, 'report.cjs'));
const { classify } = require(path.join(core.lib, 'classify.cjs'));
const registry = require(core.registry);
const { proseLines, proseBlocks, sentences, wordCount, headings, openingParagraph, changelogSection } = require('./docs-prose.cjs');
const { runVale, valeAvailable, installHint } = require('./vale-docs.cjs');

// Documents a visitor reads. Code of conduct files are left out because they
// are usually adopted verbatim from a standard text the repository doesn't own.
const ROOT_DOCS = ['README.md', 'INSTALL.md', 'CONTRIBUTING.md', 'SECURITY.md', 'RELEASE.md', 'SUPPORT.md', 'PRODUCT.md', 'ARCHITECTURE.md'];
const ADR_DIRS = ['docs/adr', 'docs/adrs', 'docs/decisions', 'doc/adr', 'adr', 'decisions'];
const ADR_SECTIONS = ['Context', 'Decision', 'Consequences', 'Alternatives rejected'];
// ASD-STE100 allows 20 words in a procedural sentence. RepoDocs.SentenceLength
// holds the 25-word limit for every other sentence.
const STEP_WORDS = 20;
const MAX_LISTED = 8;

const VALE_CHECKS = [
  ['D-punctuation', 'dashes, semicolons or inline colons in prose'],
  ['D-person', 'references to the author in the third person'],
  ['D-connectives', 'filler connectives'],
  ['D-history', 'dated history in descriptive documents'],
  ['D-sentence-length', 'sentences over the word limit'],
];
// How a finding reads in the report. Rules not listed here show the text
// Vale matched, which is the useful part for words and phrases.
const LABEL = {
  'RepoDocs.Dashes': 'dash',
  'RepoDocs.Semicolons': 'semicolon',
  'RepoDocs.InlineColons': 'inline colon',
  'RepoDocs.InlineColonsInParagraphs': 'inline colon',
  'RepoDocs.SentenceLength': 'over 25 words',
  'STE.ParagraphLength': 'over six sentences',
};
const STE_CHECKS = [
  ['D-paragraph-length', 'paragraphs over six sentences'],
  ['D-passive', 'passive constructions'],
];

function docSet(root) {
  const out = ROOT_DOCS.filter((f) => fs.existsSync(path.join(root, f)));
  const walk = (rel) => {
    let entries;
    try { entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (e.name.endsWith('.md')) out.push(child);
    }
  };
  walk('docs');
  for (const dir of ADR_DIRS.filter((d) => !d.startsWith('docs/'))) walk(dir);
  if (fs.existsSync(path.join(root, 'CHANGELOG.md'))) out.push('CHANGELOG.md');
  return [...new Set(out)];
}

const isAdr = (rel) => ADR_DIRS.some((d) => rel.startsWith(`${d}/`)) && !/(^|\/)(README|index|template)\.md$/i.test(rel);
const isGenerated = (root, rel) => /^\s*<!--\s*GENERATED/i.test(readText(path.join(root, rel)));

// Only the unreleased part of a changelog is current prose. Older entries are
// history. The section is padded back to its place in the file, so reported
// line numbers are the file's own.
function unreleased(root) {
  const text = readText(path.join(root, 'CHANGELOG.md'));
  const section = changelogSection(text, 'Unreleased');
  if (section === null) return '';
  const before = text.replace(/\r\n/g, '\n').indexOf(section);
  return '\n'.repeat(text.slice(0, before).split('\n').length - 1) + section;
}

function verdictFor(id, hits, what) {
  if (hits.length === 0) return check(id, 'pass', `no ${what}`);
  const more = hits.length > MAX_LISTED ? ` (and ${hits.length - MAX_LISTED} more)` : '';
  return check(id, 'fail', `${hits.length} ${what}: ${hits.slice(0, MAX_LISTED).join(' | ')}${more}`);
}

// A numbered step over the procedural limit. Vale can't tell an ordered list
// from a bullet, so this one limit is counted here.
function longStep(block) {
  if (block.kind !== 'step') return null;
  const over = sentences(block.text).map(wordCount).filter((n) => n > STEP_WORDS);
  return over.length ? `${Math.max(...over)} words (limit ${STEP_WORDS} for a step)` : null;
}

function stepHits(root, files) {
  const hits = [];
  for (const { rel, text } of files) {
    for (const block of proseBlocks(text)) {
      const found = longStep(block);
      if (found) hits.push(`${rel}:${block.n} ${found}`);
    }
  }
  return hits;
}

// Vale reads each document from disk, except the changelog, which goes in as
// its unreleased section written to a scratch file.
function valeChecks(root, docs, config, checks) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-docs-'));
  try {
    const files = [];
    for (const rel of docs) {
      if (isGenerated(root, rel)) continue;
      if (rel === 'CHANGELOG.md') {
        const abs = path.join(scratch, 'CHANGELOG.md');
        fs.writeFileSync(abs, unreleased(root));
        files.push({ rel, arg: abs, text: readText(abs) });
      } else {
        files.push({ rel, arg: rel, text: readText(path.join(root, rel)) });
      }
    }
    const ste = config.profile === 'ste';
    const wanted = [...VALE_CHECKS, ...(ste ? STE_CHECKS : []),
      ...(ste && config.dictionary ? [['D-vocabulary', 'words outside the approved vocabulary']] : [])];

    if (!valeAvailable()) {
      for (const [id] of wanted) {
        checks.push(check(id, 'not_evaluated', `vale is not on PATH, and these rules run in Vale. Install it with: ${installHint()}`));
      }
      return;
    }
    const dictionary = ste && config.dictionary ? readText(path.resolve(root, config.dictionary)) : null;
    const result = runVale(root, files.map((f) => f.arg), { ste, dictionary });
    if (!result.ok) {
      for (const [id] of wanted) checks.push(check(id, 'fail', result.reason));
      return;
    }
    const relOf = new Map(files.map((f) => [path.resolve(root, f.arg), f.rel]));
    const hits = Object.fromEntries(wanted.map(([id]) => [id, []]));
    for (const a of result.alerts) {
      const rel = relOf.get(path.resolve(root, a.file)) || a.file.replace(/\\/g, '/');
      (hits[a.check] || (hits[a.check] = [])).push(`${rel}:${a.line} ${LABEL[a.rule] || `"${a.match.trim()}"`}`);
    }
    hits['D-sentence-length'].push(...stepHits(root, files));
    for (const [id, what] of wanted) checks.push(verdictFor(id, hits[id], what));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

// What kind of project the README describes decides which sections it needs.
function projectType(root, cls) {
  const has = (p) => fs.existsSync(path.join(root, p));
  if (has('.claude-plugin/plugin.json') || has('.codex-plugin/plugin.json') || has('gemini-extension.json')) return 'plugin';
  const skillDirs = fs.readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && has(path.join(e.name, 'SKILL.md')));
  if (skillDirs.length > 0) return 'plugin';
  if (cls.frontendPresent || cls.serverPresent) return 'app';
  if (cls.pkg && cls.pkg.bin) return 'cli';
  if (has('main.go') || has('cmd') || has('src/main.rs')) return 'cli';
  if (has('pyproject.toml') && /\[project\.scripts\]/.test(readText(path.join(root, 'pyproject.toml')))) return 'cli';
  return 'library';
}

const TYPE_SECTIONS = {
  library: { name: 'usage', re: /usage|example|api|quick ?start/i },
  cli: { name: 'usage', re: /usage|commands|options|quick ?start/i },
  app: { name: 'how to run it', re: /usage|run|getting started|development|deploy/i },
  plugin: { name: 'what it contains', re: /skills|plugins|commands|extensions|what'?s included|contents/i },
};

function readmeChecks(root, checks) {
  const file = path.join(root, 'README.md');
  if (!fs.existsSync(file)) {
    checks.push(check('D-readme-core', 'fail', 'no README.md at the repository root'));
    checks.push(check('D-readme-type', 'not_evaluated', 'no README.md to inspect'));
    return;
  }
  const text = readText(file);
  const heads = headings(text).map((h) => h.text);
  const missing = [];
  if (openingParagraph(text).length < 40) missing.push('an opening paragraph saying what the project is');
  if (!heads.some((h) => /install|getting started|setup|quick ?start/i.test(h))) missing.push('an install section');
  const licensed = heads.some((h) => /licen[cs]e/i.test(h)) || /\b(MIT|Apache|BSD|GPL|MPL|licen[cs]e)\b/.test(text);
  if (!licensed) missing.push('the licence');
  checks.push(missing.length === 0
    ? check('D-readme-core', 'pass', 'README says what it is, how to install it and its licence')
    : check('D-readme-core', 'fail', `README is missing ${missing.join(', ')}`));

  const cls = classify(root, { evidenceDir: registry.evidenceDir });
  const type = projectType(root, cls);
  const need = TYPE_SECTIONS[type];
  checks.push(heads.some((h) => need.re.test(h))
    ? check('D-readme-type', 'pass', `${type} README has a section for ${need.name}`)
    : check('D-readme-type', 'fail', `this looks like a ${type}, and its README has no section for ${need.name}`));
}

function adrChecks(root, docs, checks) {
  const adrs = docs.filter(isAdr);
  if (adrs.length === 0) {
    checks.push(check('D-adr-structure', 'pass', 'no ADRs in this repository'));
    return;
  }
  const bad = [];
  for (const rel of adrs) {
    const text = readText(path.join(root, rel));
    const gaps = ADR_SECTIONS.filter((s) => !sectionHasContent(text, s));
    if (!/\*\*Status:\*\*/i.test(text)) gaps.unshift('Status');
    if (gaps.length) bad.push(`${rel} (${gaps.join(', ')})`);
  }
  checks.push(bad.length === 0
    ? check('D-adr-structure', 'pass', `${adrs.length} ADR(s) carry Status, Context, Decision, Consequences and Alternatives rejected`)
    : check('D-adr-structure', 'fail', `ADRs missing sections: ${bad.join(' | ')}`));
}

// Release notes are a rewrite of one changelog section for a reader. They may
// shorten it, but a figure the section never recorded is an invented one.
function releaseNumbers(root, args, checks) {
  const notesPath = path.resolve(root, args['release-notes']);
  const changelogPath = path.resolve(root, args.changelog || 'CHANGELOG.md');
  const name = args.section || 'Unreleased';
  if (!fs.existsSync(notesPath) || !fs.existsSync(changelogPath)) {
    checks.push(check('D-release-numbers', 'fail', `cannot read ${!fs.existsSync(notesPath) ? args['release-notes'] : args.changelog || 'CHANGELOG.md'}`));
    return;
  }
  const section = changelogSection(readText(changelogPath), name);
  if (section === null) {
    checks.push(check('D-release-numbers', 'fail', `CHANGELOG has no "${name}" section to check the notes against`));
    return;
  }
  const numbers = (text) => new Set((text.replace(/\b\d+\.\d+\.\d+(?:-[\w.]+)?\b/g, ' ')
    .match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, '').replace(/\.$/, '')));
  const notes = proseLines(readText(notesPath)).map((l) => l.text).join('\n');
  const known = numbers(section);
  const invented = [...numbers(notes)].filter((n) => !known.has(n));
  checks.push(invented.length === 0
    ? check('D-release-numbers', 'pass', `every figure in the notes appears in the "${name}" changelog section`)
    : check('D-release-numbers', 'fail', `figures not in the "${name}" changelog section: ${invented.join(', ')}`));
}

function styleConfig(root) {
  const file = path.join(root, '.docs-style.json');
  return fs.existsSync(file) ? JSON.parse(readText(file)) : {};
}

// The documents named by --files or --files-from. An unreadable list scans
// nothing, because it is the caller's list, and a missing one is not a
// document with problems.
function namedFiles(args) {
  if (!args['files-from']) return String(args.files).split(',');
  try { return readText(path.resolve(args['files-from'])).split(/\r?\n/); } catch { return []; }
}

function run(root, args = {}) {
  const config = styleConfig(root);
  const disabled = new Set(Array.isArray(config.disable) ? config.disable : []);
  let docs = docSet(root);
  const scoped = args.files || args['files-from'];
  if (scoped) {
    const wanted = new Set(namedFiles(args).map((s) => s.trim().replace(/\\/g, '/')).filter(Boolean));
    docs = docs.filter((d) => wanted.has(d));
  }

  const checks = [];
  valeChecks(root, docs, config, checks);
  if (!scoped || docs.includes('README.md')) readmeChecks(root, checks);
  adrChecks(root, docs, checks);
  if (args['release-notes']) releaseNumbers(root, args, checks);

  return checks.map((c) => (disabled.has(c.id) ? check(c.id, 'pass', 'disabled in .docs-style.json') : c));
}

module.exports = { run, projectType, longStep, ADR_SECTIONS, STEP_WORDS };

if (require.main === module) {
  const artifact = registry.artifacts.find((a) => a.id === 'docs-report');
  runCli({
    skill: 'repo-docs',
    reportFile: artifact ? path.basename(artifact.file) : 'docs-report.json',
    evidenceDir: registry.evidenceDir,
    runFn: run,
    argv: process.argv.slice(2),
    parseArgs,
  });
}
