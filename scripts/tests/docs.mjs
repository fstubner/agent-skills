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
  ]);

assertFixture('docs-block (each rule broken once)',
  'docs-block', DOCS, ['--release-notes', 'NOTES.md', '--section', 'Unreleased'], 'BLOCK', [
    ['D-punctuation', 'fail'], ['D-person', 'fail'], ['D-connectives', 'fail'], ['D-history', 'fail'],
    ['D-readme-core', 'fail'], ['D-readme-type', 'fail'], ['D-adr-structure', 'fail'], ['D-release-numbers', 'fail'],
  ]);

const { punctuation, history, ADR_SECTIONS } = await import(pathToFileUrl(script));

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
