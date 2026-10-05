#!/usr/bin/env node
'use strict';
// Does this repository's documentation read as professional, and is it
// shaped the way a reader expects?
//
// Built because a prose linter was not enough. Vale passed every draft of one
// set of release notes and one README that a person then rejected line by line
// for the same handful of habits: dashes and semicolons used as rhythm, inline
// colons, "plus" as a connective, the author named in the third person, and
// the history of each rule told inside the document that states the rule.
// Every one of those can be counted, so they are, here.
//
// Structure is the other half: a README missing what the project is or how to
// install it, the sections its project type needs, ADRs missing the headings
// a decision record needs, and release notes quoting a number the changelog
// never recorded.
//
// Usage: node check-docs.js --root <dir> [--files a.md,b.md | --files-from <list>]
//                           [--release-notes <file> [--section <name>] [--changelog <file>]]
//                           [--strict] [--out <file>] [--no-write] [--format text|json]
//
// A repository turns rules off with .docs-style.json: { "disable": ["D-connectives"] }.

const path = require('path');
const fs = require('fs');
const { corePaths } = require('./resolve-core.cjs');
const core = corePaths();
const { parseArgs } = require(path.join(core.lib, 'args.cjs'));
const { check, runCli, readText, sectionHasContent } = require(path.join(core.lib, 'report.cjs'));
const { classify } = require(path.join(core.lib, 'classify.cjs'));
const registry = require(core.registry);
const { proseLines, proseBlocks, sentences, wordCount, headings, openingParagraph, changelogSection } = require('./docs-prose.cjs');

// Documents a visitor reads. Code of conduct files are left out: they are
// usually adopted verbatim from a standard text the repository doesn't own.
const ROOT_DOCS = ['README.md', 'INSTALL.md', 'CONTRIBUTING.md', 'SECURITY.md', 'RELEASE.md', 'SUPPORT.md', 'PRODUCT.md', 'ARCHITECTURE.md'];
const ADR_DIRS = ['docs/adr', 'docs/adrs', 'docs/decisions', 'doc/adr', 'adr', 'decisions'];
// Documents whose owning templates use bold field labels ("**Status:**").
const LABELLED = /^(PRODUCT\.md|ARCHITECTURE\.md)$|^(docs\/adrs?|docs\/decisions|doc\/adr|adrs?|decisions)\//;
// Where dates are the content rather than history told in passing.
const DATED = /^(CHANGELOG\.md)$|^(docs\/adrs?|docs\/decisions|doc\/adr|adrs?|decisions)\//;
const ADR_SECTIONS = ['Context', 'Decision', 'Consequences', 'Alternatives rejected'];
const CONNECTIVES = ['plus', 'additionally', 'furthermore', 'moreover', 'rather than', 'as well as', 'along with'];
const MAX_LISTED = 8;

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

// The text a rule reads. Generated files are skipped whole, and only the
// unreleased part of a changelog is current prose. Older entries are history.
function readDoc(root, rel) {
  let text = readText(path.join(root, rel));
  if (/^\s*<!--\s*GENERATED/i.test(text)) return null;
  if (rel === 'CHANGELOG.md') {
    // Padded back to its place in the file, so reported line numbers are the
    // file's own and not the section's.
    const section = changelogSection(text, 'Unreleased');
    if (section === null) return '';
    const before = text.replace(/\r\n/g, '\n').indexOf(section);
    text = '\n'.repeat(text.slice(0, before).split('\n').length - 1) + section;
  }
  return text;
}

function scan(docs, root, test) {
  const hits = [];
  for (const rel of docs) {
    const text = readDoc(root, rel);
    if (text === null) continue;
    for (const line of proseLines(text)) {
      const found = test(line.text, rel);
      if (found) hits.push(`${rel}:${line.n} ${found}`);
    }
  }
  return hits;
}

function verdictFor(id, hits, what) {
  if (hits.length === 0) return check(id, 'pass', `no ${what}`);
  const more = hits.length > MAX_LISTED ? ` (and ${hits.length - MAX_LISTED} more)` : '';
  return check(id, 'fail', `${hits.length} ${what}: ${hits.slice(0, MAX_LISTED).join(' | ')}${more}`);
}

function punctuation(text, rel) {
  let line = text.replace(/&#?\w+;/g, ' ');
  if (LABELLED.test(rel)) line = line.replace(/^\s*(?:[-*]\s+)?\*\*[^*]+:\*\*/, ' ');
  const found = [];
  if (/[–—]/.test(line)) found.push('dash');
  if (line.includes(';')) found.push('semicolon');
  // Mid-line only: a colon ending a line that introduces a list or code
  // block is a different construction. Times and ratios are not prose colons.
  // Closing emphasis may sit between the colon and the space, as in a bold
  // label like "**Note:** text", which is the most common form of the habit.
  if (/(?<!\d):(?!\d)[*_]*\s+\S/.test(line.trimEnd())) found.push('inline colon');
  return found.length ? found.join(', ') : null;
}

const person = (text) => (/\bthe\s+(?:author|maintainer)s?\b/i.exec(text) || [null])[0];

function connective(text) {
  for (const word of CONNECTIVES) {
    const m = new RegExp(`\\b${word.replace(' ', '\\s+')}\\b`, 'i').exec(text);
    if (m) return `"${m[0]}"`;
  }
  return null;
}

function history(text, rel) {
  if (DATED.test(rel)) return null;
  // A date inside a filename (field-outcomes-2026-10-03.md) is a name.
  const date = /(?<![\w-])\d{4}-\d{2}-\d{2}(?![\w-]|\.\w)/.exec(text);
  if (date) return `date ${date[0]}`;
  const audit = /\b(an audit found|found by (?:an )?audit)\b/i.exec(text);
  return audit ? `"${audit[0]}"` : null;
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

// Sentence length follows ASD-STE100 Simplified Technical English: 20 words
// for a step in a procedure, 25 for a descriptive sentence. Plain-language
// guidance generally agrees, so it is on for every repository.
const STEP_WORDS = 20;
const PROSE_WORDS = 25;
// The rest of STE is opt-in with { "profile": "ste" }, because it trades a
// writer's voice for a controlled one, which not every project wants.
const PARAGRAPH_SENTENCES = 6;
const PASSIVE = /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|built|done|made|given|kept|known|shown|written|run|set|sent|taken|found)\b/i;

function blockScan(docs, root, test) {
  const hits = [];
  for (const rel of docs) {
    const text = readDoc(root, rel);
    if (text === null) continue;
    for (const block of proseBlocks(text)) {
      const found = test(block, rel);
      if (found) hits.push(`${rel}:${block.n} ${found}`);
    }
  }
  return hits;
}

function longSentence(block) {
  const limit = block.kind === 'step' ? STEP_WORDS : PROSE_WORDS;
  const over = sentences(block.text).map(wordCount).filter((n) => n > limit);
  if (over.length === 0) return null;
  return `${Math.max(...over)} words (limit ${limit}${block.kind === 'step' ? ' for a step' : ''})`;
}

function longParagraph(block) {
  if (block.kind !== 'prose') return null;
  const count = sentences(block.text).length;
  return count > PARAGRAPH_SENTENCES ? `${count} sentences (limit ${PARAGRAPH_SENTENCES})` : null;
}

// Words ending in -ed that are not participles, which the pattern would
// otherwise read as passive ("it is red", "is a need").
const NOT_PARTICIPLES = new Set(['red', 'need', 'speed', 'seed', 'feed', 'bed', 'shed', 'indeed', 'embed', 'exceed', 'proceed']);
const passive = (text) => {
  const m = PASSIVE.exec(text);
  return m && !NOT_PARTICIPLES.has(m[1].toLowerCase()) ? `"${m[0]}"` : null;
};

// A dictionary the owner supplies: one unapproved word per line, optionally
// with its approved replacement after "=>". The STE dictionary itself is free
// to obtain but not to redistribute, so none is bundled.
function vocabulary(root, file) {
  const escape = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const words = readText(path.resolve(root, file)).split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim()).filter(Boolean)
    .map((l) => {
      const [word, use] = l.split('=>').map((x) => x.trim());
      return { word, use, re: new RegExp(`\\b${escape(word)}\\b`, 'i') };
    });
  return (text) => {
    const hit = words.find((w) => w.re.test(text));
    if (!hit) return null;
    return hit.use ? `"${hit.word}" (use "${hit.use}")` : `"${hit.word}"`;
  };
}

// The documents named by --files or --files-from. An unreadable list scans
// nothing: it is the caller's list, and a missing one is not a document with
// problems.
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
  checks.push(verdictFor('D-punctuation', scan(docs, root, punctuation), 'dashes, semicolons or inline colons in prose'));
  checks.push(verdictFor('D-person', scan(docs, root, person), 'references to the author in the third person'));
  checks.push(verdictFor('D-connectives', scan(docs, root, connective), 'filler connectives'));
  checks.push(verdictFor('D-history', scan(docs, root, history), 'dated history in descriptive documents'));
  checks.push(verdictFor('D-sentence-length', blockScan(docs, root, longSentence), 'sentences over the word limit'));
  if (config.profile === 'ste') {
    checks.push(verdictFor('D-paragraph-length', blockScan(docs, root, longParagraph), 'paragraphs over six sentences'));
    checks.push(verdictFor('D-passive', scan(docs, root, passive), 'passive constructions'));
    if (config.dictionary) {
      checks.push(verdictFor('D-vocabulary', scan(docs, root, vocabulary(root, config.dictionary)), 'words outside the approved vocabulary'));
    }
  }
  if (!scoped || docs.includes('README.md')) readmeChecks(root, checks);
  adrChecks(root, docs, checks);
  if (args['release-notes']) releaseNumbers(root, args, checks);

  return checks.map((c) => (disabled.has(c.id) ? check(c.id, 'pass', `disabled in .docs-style.json`) : c));
}

module.exports = { run, punctuation, connective, history, projectType, longSentence, longParagraph, passive, ADR_SECTIONS };

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
