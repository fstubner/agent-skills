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

// Vale enforces a strict per-extension key schema and rejects the WHOLE
// style — every rule, not just the offending file — on one unrecognized
// top-level key. A documentation-only "example" field must never be a real
// yml key; it's declared as a `# gen-patterns-example: <text>` comment
// instead, which vale ignores as a comment and this function extracts
// directly from the raw text (parseSimpleYaml skips comment lines).
function exampleFromComment(text) {
  const m = text.match(/^#\s*gen-patterns-example:\s*(.+)$/m);
  return m ? m[1].trim() : null;
}

// Known-good top-level keys across all six `extends: existence` rules in
// this style. Guards against the exact failure mode that motivated this
// check: an unrecognized key (e.g. a stray "example:") doesn't just break
// generation, it breaks vale loading the ENTIRE style at runtime, which
// check-prose.js's stdout-only error handling was separately found to
// swallow as "zero findings" — fixed there too, but this check catches the
// mistake before it ever reaches vale.
const KNOWN_YAML_KEYS = new Set(['extends', 'message', 'link', 'level', 'ignorecase', 'scope', 'tokens', 'raw', 'max', 'token']);

function loadRule(fileName) {
  const text = fs.readFileSync(path.join(rulesDir, fileName), 'utf8');
  const parsed = parseSimpleYaml(text);
  for (const key of Object.keys(parsed)) {
    if (!KNOWN_YAML_KEYS.has(key)) {
      throw new Error(
        `${fileName}: top-level key "${key}" is not a real vale key — vale will reject the ` +
        `whole style at runtime with "has invalid keys". Documentation-only values go in a ` +
        `"# gen-patterns-example: <text>" comment instead, not a real yml key.`
      );
    }
  }
  return { parsed, example: exampleFromComment(text) };
}

// Renders the word/phrase span for a `tokens:`-based rule (comma list), a
// `raw:`-based rule with an enumerable (a|b|c) alternation (quoted-phrase
// list), or a structural pattern with no enumerable list at all — those
// declare a `# gen-patterns-example:` comment instead, rendered as-is.
// `example` is checked first because a rule may carry both `raw` (for
// vale) and an example comment (for documentation) when the raw pattern
// has no alternation to enumerate.
function renderTokensSpan(fileName) {
  const { parsed: rule, example } = loadRule(fileName);
  if (example) {
    return `*e.g. "${example}"*`;
  }
  if (rule.tokens) {
    return `*${rule.tokens.map(humanizeToken).join(', ')}.*`;
  }
  if (rule.raw) {
    const raws = Array.isArray(rule.raw) ? rule.raw : [rule.raw];
    const phrases = raws.flatMap(phrasesFromRaw);
    return `*${phrases.map((p) => `"${p}"`).join(' ')}*`;
  }
  throw new Error(`${fileName}: no "tokens", "raw", or example comment to render`);
}

function renderScalarSpan(fileName, field) {
  const { parsed: rule } = loadRule(fileName);
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
