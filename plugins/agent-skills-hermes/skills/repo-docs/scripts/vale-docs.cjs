'use strict';
// Runs Vale with this skill's styles over a set of documents and returns the
// alerts grouped by the check id check-docs.js reports them under.
//
// Vale is the engine for every voice and Simplified Technical English rule.
// The rules live as Vale styles in ../rules, so the same rules show up in an
// editor with the Vale extension, in CI, and here. check-docs.js keeps only
// what Vale cannot express: document structure, release-note figures, and the
// stricter limit for numbered steps, which needs to tell an ordered list from
// a bullet.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RULES_DIR = path.join(__dirname, '..', 'rules');

// Vale rule -> the check id it reports under.
const RULE_CHECK = {
  'RepoDocs.Dashes': 'D-punctuation',
  'RepoDocs.Semicolons': 'D-punctuation',
  'RepoDocs.InlineColons': 'D-punctuation',
  'RepoDocs.InlineColonsInParagraphs': 'D-punctuation',
  'RepoDocs.Person': 'D-person',
  'RepoDocs.Connectives': 'D-connectives',
  'RepoDocs.History': 'D-history',
  'RepoDocs.SentenceLength': 'D-sentence-length',
  'STE.ParagraphLength': 'D-paragraph-length',
  'STE.Passive': 'D-passive',
  'STEVocabulary.Unapproved': 'D-vocabulary',
  'STEVocabulary.Replace': 'D-vocabulary',
};

// Dates are the content of a changelog or an ADR, and templates owned by other
// skills use bold field labels and a colon in the ADR title. Those files get
// the paragraph-only colon rule, so their prose is still checked.
const DATED = '{**/CHANGELOG.md,**/docs/adr/**,**/docs/adrs/**,**/docs/decisions/**,**/doc/adr/**,**/adr/**,**/decisions/**}';
const LABELLED = '{**/PRODUCT.md,**/ARCHITECTURE.md,**/docs/adr/**,**/docs/adrs/**,**/docs/decisions/**,**/doc/adr/**,**/adr/**,**/decisions/**}';

function installHint() {
  if (process.platform === 'win32') return 'winget install errata-ai.Vale';
  if (process.platform === 'darwin') return 'brew install vale';
  return 'see https://vale.sh/docs/install';
}

function valeAvailable() {
  const probe = spawnSync('vale', ['--version'], { encoding: 'utf8' });
  return !probe.error && probe.status === 0;
}

// The owner's dictionary: one unapproved word per line, optionally followed
// by "=> approved". The ASD-STE100 dictionary is free to request but may not
// be redistributed, so none ships with this skill.
function vocabularyStyle(dictionaryText) {
  const swap = [];
  const banned = [];
  for (const raw of dictionaryText.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [word, use] = line.split('=>').map((x) => x.trim());
    if (use) swap.push([word, use]);
    else banned.push(word);
  }
  const quote = (s) => `'${s.replace(/'/g, "''")}'`;
  const files = {};
  if (swap.length) {
    files['Replace.yml'] = ['extends: substitution', 'message: "Use \'%s\' instead of \'%s\' (approved vocabulary)."',
      'level: error', 'ignorecase: true', 'swap:', ...swap.map(([w, u]) => `  ${quote(w)}: ${quote(u)}`), ''].join('\n');
  }
  if (banned.length) {
    files['Unapproved.yml'] = ['extends: existence', 'message: "\'%s\' is not in the approved vocabulary."',
      'level: error', 'ignorecase: true', 'tokens:', ...banned.map((w) => `  - ${quote(w)}`), ''].join('\n');
  }
  return files;
}

// Runs Vale over `files` (paths relative to root, or absolute) and returns
// { ok: true, alerts: [{ file, line, check, rule, match }] } or
// { ok: false, reason }.
function runVale(root, files, { ste = false, dictionary = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-docs-vale-'));
  try {
    const styles = path.join(dir, 'styles');
    fs.cpSync(RULES_DIR, styles, { recursive: true });
    const based = ['RepoDocs'];
    if (ste) based.push('STE');
    if (ste && dictionary) {
      const style = vocabularyStyle(dictionary);
      if (Object.keys(style).length) {
        fs.mkdirSync(path.join(styles, 'STEVocabulary'));
        for (const [name, body] of Object.entries(style)) fs.writeFileSync(path.join(styles, 'STEVocabulary', name), body);
        based.push('STEVocabulary');
      }
    }
    const config = path.join(dir, 'vale.ini');
    fs.writeFileSync(config, [
      `StylesPath = ${styles.split(path.sep).join('/')}`,
      'MinAlertLevel = suggestion',
      'SkippedScopes = script, style, pre, figure, table',
      '',
      '[*.md]',
      `BasedOnStyles = ${based.join(', ')}`,
      'RepoDocs.InlineColonsInParagraphs = NO',
      '',
      `[${DATED}]`,
      'RepoDocs.History = NO',
      '',
      `[${LABELLED}]`,
      'RepoDocs.InlineColons = NO',
      'RepoDocs.InlineColonsInParagraphs = YES',
      '',
    ].join('\n'));
    if (files.length === 0) return { ok: true, alerts: [] };
    // These rules are error level, and Vale exits 1 whenever one fires, so the
    // exit code can't tell findings from a failed run. --no-exit makes findings
    // exit 0. A run counts as clean only if stdout parses as Vale's report. An
    // empty or broken stdout is Vale failing to run, never "no findings".
    const r = spawnSync('vale', ['--config', config, '--output=JSON', '--no-exit', '--', ...files], {
      cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
    });
    let parsed = null;
    try { parsed = JSON.parse(r.stdout); } catch { parsed = null; }
    if (r.error || r.status !== 0 || parsed === null || typeof parsed !== 'object') {
      const why = r.error ? r.error.message : `exit ${r.status}`;
      return { ok: false, reason: `vale did not run cleanly (${why}): ${(r.stderr || r.stdout || '').slice(0, 300)}` };
    }
    const alerts = [];
    for (const [file, list] of Object.entries(parsed)) {
      for (const a of list) {
        alerts.push({ file, line: a.Line, rule: a.Check, check: RULE_CHECK[a.Check] || a.Check, match: a.Match });
      }
    }
    return { ok: true, alerts };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { runVale, valeAvailable, installHint, vocabularyStyle, RULE_CHECK, RULES_DIR };
