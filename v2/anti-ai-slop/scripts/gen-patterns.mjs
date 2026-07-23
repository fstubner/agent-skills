#!/usr/bin/env node
// Generates the deterministic word/threshold lists embedded in
// references/patterns.md from the Vale rule .yml files that actually
// enforce them. The .yml is the single source of truth; patterns.md's
// <!-- gen-patterns --> spans are DERIVED and must never be hand-edited —
// that is exactly how patterns.md once claimed "robust"/"realm" were
// Vale-checkable while InflatedVocabulary.yml never listed them.
//
// Usage:
//   node gen-patterns.mjs           regenerate references/patterns.md
//   node gen-patterns.mjs --check   exit 1 if patterns.md is out of date,
//                                   or if any rule .yml has no marker

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rulesDir = path.join(skillRoot, 'rules', 'AntiAISlop');
const patternsPath = path.join(skillRoot, 'references', 'patterns.md');

// Minimal hand-rolled extractor for the flat YAML shapes these rule files
// actually use (a `tokens:` list, a `raw:` list, or scalar `token:`/`max:`
// fields) — deliberately not a real YAML parser, to keep this skill
// dependency-free like the rest of the suite. Anything more exotic than
// "flat list or scalar" will parse wrong; that's an acceptable limit given
// what these six files actually contain.
function parseSimpleYaml(text) {
  const result = {};
  let currentListKey = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (/^\s*#/.test(line) || line.trim() === '') continue;
    const listItem = line.match(/^\s*-\s*(.+)$/);
    if (listItem && currentListKey) {
      result[currentListKey].push(stripQuotes(listItem[1].trim()));
      continue;
    }
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      const [, key, rest] = kv;
      if (rest.trim() === '') {
        currentListKey = key;
        result[key] = [];
      } else {
        currentListKey = null;
        result[key] = stripQuotes(rest.trim());
      }
    }
  }
  return result;
}

function stripQuotes(s) {
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

// Renders a non-capturing regex alternation like "(?:power|potential)" as
// "power/potential", for the one InflatedVocabulary token that is itself a
// small regex.
function humanizeToken(t) {
  return t.replace(/\(\?:([^)]+)\)/g, (_, alts) => alts.split('|').join('/'));
}

// SummaryRecap's shape is `raw: ['(?m)^(In conclusion|To summarize|...),']`
// — note there are TWO parenthesized groups: the non-capturing `(?m)` flag
// modifier and the real `(a|b|c)` alternation. Pick the first group that
// actually contains a `|` rather than the first `(...)` found, or this
// grabs "?m" as the "alternation" (a real bug caught by --check the first
// time this ran). Treat everything after the alternation group as common
// punctuation shared by every phrase. This is coupled to that one rule's
// exact structure; a future raw-based rule with no alternation group needs
// a second case here, not a silent wrong render.
function phrasesFromRaw(rawPattern) {
  const groups = [...rawPattern.matchAll(/\(([^()]*)\)/g)];
  const altGroup = groups.find((g) => g[1].includes('|'));
  if (!altGroup) throw new Error(`raw pattern has no (a|b|c) alternation group: ${rawPattern}`);
  const suffix = rawPattern.slice(altGroup.index + altGroup[0].length);
  return altGroup[1].split('|').map((phrase) => phrase + suffix);
}

function loadRule(fileName) {
  const text = fs.readFileSync(path.join(rulesDir, fileName), 'utf8');
  return parseSimpleYaml(text);
}

// Renders the word/phrase span for a `tokens:`-based rule (comma list) or a
// `raw:`-based rule (quoted-phrase list) — the two existing shapes.
function renderTokensSpan(fileName) {
  const rule = loadRule(fileName);
  if (rule.tokens) {
    return `*${rule.tokens.map(humanizeToken).join(', ')}.*`;
  }
  if (rule.raw) {
    const raws = Array.isArray(rule.raw) ? rule.raw : [rule.raw];
    const phrases = raws.flatMap(phrasesFromRaw);
    return `*${phrases.map((p) => `"${p}"`).join(' ')}*`;
  }
  throw new Error(`${fileName}: no "tokens" or "raw" field to render`);
}

function renderScalarSpan(fileName, field) {
  const rule = loadRule(fileName);
  if (rule[field] === undefined) throw new Error(`${fileName}: no "${field}" field`);
  return String(rule[field]);
}

const MARKER = /<!-- gen-patterns:(tokens|max) ([\w.]+) -->[\s\S]*?<!-- \/gen-patterns -->/g;

function render(patternsText) {
  return patternsText.replace(MARKER, (_whole, kind, sourceFile) => {
    const body = kind === 'tokens' ? renderTokensSpan(sourceFile) : renderScalarSpan(sourceFile, 'max');
    return `<!-- gen-patterns:${kind} ${sourceFile} -->${body}<!-- /gen-patterns -->`;
  });
}

function referencedRuleFiles(patternsText) {
  const found = new Set();
  for (const m of patternsText.matchAll(MARKER)) found.add(m[2]);
  return found;
}

const current = fs.readFileSync(patternsPath, 'utf8');
const regenerated = render(current);

// Every rule .yml must be referenced by at least one marker — otherwise a
// new or edited rule can silently go undocumented, with nothing in
// patterns.md ever checked against it.
const onDiskRules = fs.readdirSync(rulesDir).filter((f) => f.endsWith('.yml'));
const referenced = referencedRuleFiles(current);
const undocumented = onDiskRules.filter((f) => !referenced.has(f));

const check = process.argv.includes('--check');

if (check) {
  let failed = false;
  if (regenerated !== current) {
    console.error('references/patterns.md is out of date with rules/AntiAISlop/*.yml — run: node scripts/gen-patterns.mjs');
    failed = true;
  }
  if (undocumented.length > 0) {
    console.error(`rule file(s) with no <!-- gen-patterns --> marker in patterns.md: ${undocumented.join(', ')}`);
    failed = true;
  }
  if (failed) process.exit(1);
  console.log('references/patterns.md matches rules/AntiAISlop/*.yml');
  process.exit(0);
}

if (undocumented.length > 0) {
  console.error(`Warning: rule file(s) with no <!-- gen-patterns --> marker in patterns.md: ${undocumented.join(', ')}`);
}
fs.writeFileSync(patternsPath, regenerated);
console.log(`wrote ${patternsPath}`);
