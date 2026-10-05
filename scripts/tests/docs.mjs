// repo-docs: the voice and structure checker for repository documents.
//
// Each rule exists because a draft broke it and a prose linter passed it.
// docs-ship holds a document set that follows every rule, including the cases
// a careless rule would trip on: a literal with a colon in backticks, a dated
// filename in a link, an ADR's bold field labels and date, a changelog whose
// released entries break the rules, and a generated page full of violations.
// docs-block breaks each rule once, so every check has to fail for its own
// reason.
import fs from 'fs';
import path from 'path';
import { root, read, expect, tmpBase, runNode, assertFixture, pathToFileUrl } from './harness.mjs';

const DOCS = 'repo-docs/scripts/check-docs.js';
const script = path.join(root, ...DOCS.split('/'));

assertFixture('docs-ship (every rule followed, including the cases a careless rule trips on)',
  'docs-ship', DOCS, ['--release-notes', 'NOTES.md', '--section', '1.2.0'], 'SHIP', [
    ['D-punctuation', 'pass'], ['D-person', 'pass'], ['D-connectives', 'pass'], ['D-history', 'pass'],
    ['D-readme-core', 'pass'], ['D-readme-type', 'pass'], ['D-adr-structure', 'pass'], ['D-release-numbers', 'pass'],
    ['D-sentence-length', 'pass'],
  ]);

assertFixture('docs-block (each rule broken once)',
  'docs-block', DOCS, ['--release-notes', 'NOTES.md', '--section', 'Unreleased'], 'BLOCK', [
    ['D-punctuation', 'fail'], ['D-person', 'fail'], ['D-connectives', 'fail'], ['D-history', 'fail'],
    ['D-readme-core', 'fail'], ['D-readme-type', 'fail'], ['D-adr-structure', 'fail'], ['D-release-numbers', 'fail'],
    ['D-sentence-length', 'fail'],
  ]);

const { punctuation, history, longSentence, longParagraph, passive, ADR_SECTIONS } = await import(pathToFileUrl(script));
const { proseBlocks, sentences, wordCount } = await import(pathToFileUrl(path.join(root, 'repo-docs', 'scripts', 'docs-prose.cjs')));

// Sentence length, after ASD-STE100: 25 words for prose, 20 for a numbered
// step. The limit is only as good as the sentence splitting under it, and
// the first version merged bullet items and missed breaks next to code.
{
  const words = (n) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
  expect('docs: a 25-word sentence is within the prose limit', longSentence({ kind: 'prose', text: `${words(25)}.` }) === null);
  expect('docs: a 26-word sentence is over it', /26 words/.test(longSentence({ kind: 'prose', text: `${words(26)}.` }) || ''));
  expect('docs: a numbered step has the stricter 20-word limit', /limit 20/.test(longSentence({ kind: 'step', text: `${words(21)}.` }) || ''));
  const blocks = proseBlocks(['- first item with no stop', '- second item', '', '1. A step.', ''].join('\n'));
  expect('docs: bullet items are separate units, never merged',
    blocks.length === 3 && blocks.map((b) => b.kind).join(',') === 'item,item,step', JSON.stringify(blocks));
  expect('docs: inline code counts as a word', wordCount(proseBlocks('Run `npm test` now.')[0].text) === 3);
  expect('docs: a sentence that starts with inline code still starts a new sentence',
    sentences(proseBlocks('It ends here. `tool` starts the next.')[0].text).length === 2);
  expect('docs: a bold lead sentence ends at its full stop',
    sentences('**Reports are evidence.** The gate re-runs them.').length === 2);
  expect('docs: e.g. does not end a sentence', sentences('Use a short name, e.g. the ticket id.').length === 1);
  expect('docs: a paragraph of seven sentences is over the STE limit',
    /7 sentences/.test(longParagraph({ kind: 'prose', text: 'A one. B two. C three. D four. E five. F six. G seven.' }) || ''));
  expect('docs: a passive construction is found', passive('The file is generated from the registry.') !== null);
  expect('docs: an adjective ending in -ed is not passive', passive('The light is red.') === null);
}

// The edges of the punctuation rule, each a construction a reader doesn't
// see as a prose colon or dash.
expect('docs: a colon ending a line that introduces a list is allowed',
  punctuation('Run these from the root of your checkout:', 'README.md') === null);
expect('docs: a time is not an inline colon', punctuation('The job runs at 10:30 every day.', 'README.md') === null);
expect('docs: a mid-line colon in prose is flagged',
  punctuation('Note: dry runs never push.', 'README.md') === 'inline colon');
expect('docs: a bold field label is exempt in an ADR',
  punctuation('- **Status:** Accepted', 'docs/adr/0001-x.md') === null);
expect('docs: the same label is not exempt in a README',
  punctuation('- **Status:** Accepted', 'README.md') === 'inline colon');
expect('docs: every kind on a line is reported, not just the first',
  punctuation('One part; another — and Note: a third.', 'README.md') === 'dash, semicolon, inline colon');

// A date is history in a README and content in an ADR or a filename.
expect('docs: a date in a README sentence is history', history('Added on 2026-04-02 after a bug.', 'README.md') !== null);
expect('docs: a date in a filename is a name', history('See bench-2026-03-01.md for numbers.', 'README.md') === null);
expect('docs: a date in an ADR is content', history('Decided on 2026-04-02.', 'docs/adr/0001-x.md') === null);

// The ADR sections this checker requires are the ones the template in
// systems-architecture asks for. The template owns the shape, so the two must
// not drift apart.
{
  const template = read(path.join(root, 'systems-architecture', 'assets', 'ADR.md'));
  const templateSections = [...template.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]);
  expect('docs: ADR checks match the systems-architecture template',
    JSON.stringify(templateSections) === JSON.stringify(ADR_SECTIONS),
    `template ${JSON.stringify(templateSections)} vs checker ${JSON.stringify(ADR_SECTIONS)}`);
}

// A repository can turn a rule off, and the report says it was turned off.
{
  const dir = path.join(tmpBase, 'docs-disabled');
  fs.cpSync(path.join(root, 'fixtures', 'docs-block'), dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.docs-style.json'), JSON.stringify({ disable: ['D-connectives'] }));
  const r = runNode(script, ['--root', dir, '--no-write']);
  const report = JSON.parse(r.stdout);
  const c = report.checks.find((x) => x.id === 'D-connectives');
  expect('docs: a rule disabled in .docs-style.json passes and says why',
    c.status === 'pass' && /disabled/.test(c.detail), JSON.stringify(c));
  expect('docs: disabling one rule leaves the others failing',
    report.checks.find((x) => x.id === 'D-person').status === 'fail');
}

// --files scopes the scan to the named documents, as the pre-commit hook
// needs. Naming only the ADR checks the ADR and leaves the README alone.
{
  const dir = path.join(tmpBase, 'docs-scoped');
  fs.cpSync(path.join(root, 'fixtures', 'docs-block'), dir, { recursive: true });
  const r = runNode(script, ['--root', dir, '--no-write', '--files', 'docs/adr/0001-tag-format.md']);
  const report = JSON.parse(r.stdout);
  const ids = report.checks.map((c) => c.id);
  expect('docs: --files leaves an unnamed README unchecked', !ids.includes('D-readme-core'), ids.join(','));
  expect('docs: --files still checks the named ADR',
    report.checks.find((c) => c.id === 'D-adr-structure').status === 'fail');
  expect('docs: --files ignores violations in documents it was not given',
    report.checks.find((c) => c.id === 'D-punctuation').status === 'pass');
}

// The rest of ASD-STE100 is opt-in. Off by default, so a repository that
// hasn't asked for it never sees these checks.
{
  const plain = runNode(script, ['--root', path.join(root, 'fixtures', 'docs-ship'), '--no-write']);
  const ids = JSON.parse(plain.stdout).checks.map((c) => c.id);
  expect('docs: the STE profile is off unless asked for',
    !ids.includes('D-paragraph-length') && !ids.includes('D-passive') && !ids.includes('D-vocabulary'), ids.join(','));

  const dir = path.join(tmpBase, 'docs-ste');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.docs-style.json'), JSON.stringify({ profile: 'ste', dictionary: 'ste-words.txt' }));
  fs.writeFileSync(path.join(dir, 'ste-words.txt'), ['# unapproved => approved', 'commence => start', ''].join('\n'));
  fs.writeFileSync(path.join(dir, 'CONTRIBUTING.md'), [
    '# Contributing', '',
    'One. Two. Three. Four. Five. Six. Seven.', '',
    'The suite is run by CI. Commence a branch.', '',
  ].join('\n'));
  const r = runNode(script, ['--root', dir, '--no-write']);
  const report = JSON.parse(r.stdout);
  const status = (id) => report.checks.find((c) => c.id === id)?.status;
  expect('docs(ste): a seven-sentence paragraph fails', status('D-paragraph-length') === 'fail', JSON.stringify(report.checks));
  expect('docs(ste): passive voice fails', status('D-passive') === 'fail');
  expect('docs(ste): a word the owner listed as unapproved fails, with its replacement',
    status('D-vocabulary') === 'fail' && /use "start"/.test(report.checks.find((c) => c.id === 'D-vocabulary').detail));
}
