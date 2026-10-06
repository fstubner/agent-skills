// repo-docs: voice, ASD-STE100 and structure checks for repository documents.
//
// The voice and STE rules are Vale styles. Their edge cases live beside them
// in repo-docs/rules/tests and run through `vale test`. What is pinned here is
// check-docs.js as a user runs it. docs-ship follows every rule, including the cases
// a careless rule trips on. docs-block breaks each rule once, so every check
// has to fail for its own reason.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { root, read, expect, tmpBase, runNode, assertFixture, pathToFileUrl } from './harness.mjs';

const DOCS = 'repo-docs/scripts/check-docs.js';
const script = path.join(root, ...DOCS.split('/'));
const hasVale = (() => { const p = spawnSync('vale', ['--version'], { encoding: 'utf8' }); return !p.error && p.status === 0; })();

// Runs check-docs on a scratch repository holding `files`, and returns its
// report. `name` keeps each scratch directory apart.
let scratchCount = 0;
function docsReport(files, { config = null, args = [] } = {}) {
  const dir = path.join(tmpBase, `docs-case-${scratchCount++}`);
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  if (config) fs.writeFileSync(path.join(dir, '.docs-style.json'), JSON.stringify(config));
  const r = runNode(script, ['--root', dir, '--no-write', ...args]);
  return JSON.parse(r.stdout);
}
const statusOf = (report, id) => report.checks.find((c) => c.id === id)?.status;
const detailOf = (report, id) => report.checks.find((c) => c.id === id)?.detail || '';
const lines = (...l) => `${l.join('\n')}\n`;

// ---------- The Node-side pieces, which run without Vale ----------
const { longStep, ADR_SECTIONS, STEP_WORDS } = await import(pathToFileUrl(script));
const { proseBlocks, sentences, wordCount } = await import(pathToFileUrl(path.join(root, 'repo-docs', 'scripts', 'docs-prose.cjs')));
{
  const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  expect('docs: a 20-word numbered step is within the step limit', longStep({ kind: 'step', text: `${words(20)}.` }) === null);
  expect('docs: a 21-word numbered step is over it', /21 words/.test(longStep({ kind: 'step', text: `${words(21)}.` }) || ''));
  expect('docs: the step limit applies to numbered steps only', longStep({ kind: 'item', text: `${words(24)}.` }) === null);
  const blocks = proseBlocks(['- first item with no stop', '- second item', '', '1. A step.', ''].join('\n'));
  expect('docs: bullet items are separate units, never merged',
    blocks.length === 3 && blocks.map((b) => b.kind).join(',') === 'item,item,step', JSON.stringify(blocks));
  expect('docs: inline code counts as a word', wordCount(proseBlocks('Run `npm test` now.')[0].text) === 3);
  expect('docs: a bold lead sentence ends at its full stop', sentences('**Reports are evidence.** The gate re-runs them.').length === 2);
}

// The two word limits live in two places, the Vale style for prose and
// check-docs.js for steps, and SKILL.md states both. They must agree.
{
  const style = read(path.join(root, 'repo-docs', 'rules', 'RepoDocs', 'SentenceLength.yml'));
  const proseMax = Number((/^max:\s*(\d+)/m.exec(style) || [])[1]);
  const skill = read(path.join(root, 'repo-docs', 'SKILL.md'));
  expect('docs: the Vale sentence limit is 25 and SKILL.md says so',
    proseMax === 25 && /25 words in prose/.test(skill), `style max ${proseMax}`);
  expect('docs: the step limit is 20 and SKILL.md says so',
    STEP_WORDS === 20 && /20 in a numbered step/.test(skill), `STEP_WORDS ${STEP_WORDS}`);
}

// The ADR sections checked here are the ones the systems-architecture
// template asks for. The template owns the shape.
{
  const template = read(path.join(root, 'systems-architecture', 'assets', 'ADR.md'));
  const templateSections = [...template.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
  expect('docs: ADR checks match the systems-architecture template',
    JSON.stringify(templateSections) === JSON.stringify(ADR_SECTIONS),
    `template ${JSON.stringify(templateSections)} vs checker ${JSON.stringify(ADR_SECTIONS)}`);
}

// Without Vale the rules that run in it are not evaluated, never passed.
{
  const env = { ...process.env, PATH: path.dirname(process.execPath), Path: path.dirname(process.execPath) };
  const r = spawnSync(process.execPath, [script, '--root', path.join(root, 'fixtures', 'docs-ship'), '--no-write'],
    { encoding: 'utf8', env });
  const report = JSON.parse(r.stdout);
  expect('docs: without Vale the voice rules are not_evaluated, not passed',
    statusOf(report, 'D-punctuation') === 'not_evaluated' && /vale is not on PATH/.test(detailOf(report, 'D-punctuation')),
    JSON.stringify(report.checks.slice(0, 2)));
  expect('docs: without Vale the structure checks still run', statusOf(report, 'D-readme-core') === 'pass');
}

if (!hasVale) {
  console.log('skip  repo-docs Vale rules: vale is not installed');
} else {
  assertFixture('docs-ship (every rule followed, including the cases a careless rule trips on)',
    'docs-ship', DOCS, ['--release-notes', 'NOTES.md', '--section', '1.2.0'], 'SHIP', [
      ['D-punctuation', 'pass'], ['D-person', 'pass'], ['D-connectives', 'pass'], ['D-history', 'pass'],
      ['D-sentence-length', 'pass'], ['D-readme-core', 'pass'], ['D-readme-type', 'pass'],
      ['D-adr-structure', 'pass'], ['D-release-numbers', 'pass'],
    ]);
  assertFixture('docs-block (each rule broken once)',
    'docs-block', DOCS, ['--release-notes', 'NOTES.md', '--section', 'Unreleased'], 'BLOCK', [
      ['D-punctuation', 'fail'], ['D-person', 'fail'], ['D-connectives', 'fail'], ['D-history', 'fail'],
      ['D-sentence-length', 'fail'], ['D-readme-core', 'fail'], ['D-readme-type', 'fail'],
      ['D-adr-structure', 'fail'], ['D-release-numbers', 'fail'],
    ]);

  // The edges of each Vale rule are cases in rules/tests, run by Vale itself.
  // --coverage fails a rule that no case makes fire. `vale test` arrived in
  // Vale 3.24, and CI pins that version.
  {
    const rules = path.join(root, 'repo-docs', 'rules');
    const r = spawnSync('vale', ['test', '--coverage', 'tests', 'RepoDocs', 'STE'], { cwd: rules, encoding: 'utf8' });
    const out = `${r.stdout}${r.stderr}`;
    expect('docs: every Vale rule passes its cases in rules/tests, and each one fires in at least one',
      r.status === 0 && /SUCCESS/.test(out),
      /unknown command|No help topic|flag provided/i.test(out) ? `vale test needs Vale 3.24 or later: ${out.slice(0, 200)}` : out.slice(-600));
  }

  // What the cases can't show is the configuration check-docs writes, so the
  // remaining cases run through check-docs.js.
  const contributing = (body) => docsReport({ 'CONTRIBUTING.md': lines('# Contributing', '', ...body) });
  expect('docs: table cells are not prose',
    statusOf(contributing(['| a: b | c; d |', '|---|---|', '| e — f | g |']), 'D-punctuation') === 'pass');
  {
    const adr = docsReport({ 'docs/adr/0001-x.md': lines('# ADR 1: Keep order', '', '- **Date:** 2026-01-10',
      '- **Status:** Accepted', '', '## Context', '', 'Note: a prose colon.') });
    expect('docs: an ADR keeps its template labels, title and date',
      !/:(1|3|4) /.test(detailOf(adr, 'D-punctuation')) && statusOf(adr, 'D-history') === 'pass', JSON.stringify(adr.checks));
    expect('docs: an ADR\'s prose colons are still flagged', /:8 inline colon/.test(detailOf(adr, 'D-punctuation')));
  }
  expect('docs: a date in a README sentence is history',
    statusOf(contributing(['Added on 2026-04-02 after a bug.']), 'D-history') === 'fail');

  // The opt-in ASD-STE100 profile.
  {
    const plain = docsReport({ 'CONTRIBUTING.md': lines('# C', '', 'The file is generated by the build.') });
    expect('docs: the STE profile is off unless asked for',
      !plain.checks.some((c) => ['D-paragraph-length', 'D-passive', 'D-vocabulary'].includes(c.id)));
    const ste = (body, extra = {}) => docsReport({ 'CONTRIBUTING.md': lines('# C', '', ...body), ...(extra.files || {}) },
      { config: { profile: 'ste', ...(extra.config || {}) } });
    expect('docs(ste): the profile turns the STE rules on', statusOf(ste(['The file is generated by the build.']), 'D-passive') === 'fail');
    const vocab = ste(['Commence a branch.'], {
      config: { dictionary: 'words.txt' }, files: { 'words.txt': lines('# unapproved => approved', 'commence => start') },
    });
    expect('docs(ste): a word the owner listed as unapproved fails', statusOf(vocab, 'D-vocabulary') === 'fail', JSON.stringify(vocab.checks));
    const broken = ste(['Text.'], { config: { dictionary: 'words.txt' }, files: { 'words.txt': lines('( => x') } });
    expect('docs(ste): a Vale run that breaks is a failure, never a pass',
      statusOf(broken, 'D-vocabulary') === 'fail' && /did not run cleanly/.test(detailOf(broken, 'D-vocabulary')),
      JSON.stringify(broken.checks));
  }

  // A repository can turn a rule off, and the report says it was turned off.
  {
    const dir = path.join(tmpBase, 'docs-disabled');
    fs.cpSync(path.join(root, 'fixtures', 'docs-block'), dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.docs-style.json'), JSON.stringify({ disable: ['D-connectives'] }));
    const report = JSON.parse(runNode(script, ['--root', dir, '--no-write']).stdout);
    expect('docs: a rule disabled in .docs-style.json passes and says why',
      statusOf(report, 'D-connectives') === 'pass' && /disabled/.test(detailOf(report, 'D-connectives')));
    expect('docs: disabling one rule leaves the others failing', statusOf(report, 'D-person') === 'fail');
  }

  // --files scopes the scan to the named documents, as the pre-commit hook
  // needs. Naming only the ADR checks the ADR and leaves the README alone.
  {
    const report = JSON.parse(runNode(script, ['--root', path.join(root, 'fixtures', 'docs-block'), '--no-write',
      '--files', 'docs/adr/0001-tag-format.md']).stdout);
    expect('docs: --files leaves an unnamed README unchecked', !report.checks.some((c) => c.id === 'D-readme-core'));
    expect('docs: --files still checks the named ADR', statusOf(report, 'D-adr-structure') === 'fail');
    expect('docs: --files ignores violations in documents it was not given', statusOf(report, 'D-punctuation') === 'pass');
  }
}
