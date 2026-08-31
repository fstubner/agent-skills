// The pre-registration only means anything if it stays complete and honest:
// every case, every assertion, no drift as cases are added, and no case where
// the split is degenerate (all rule-targeted) because that would make the
// circularity check unable to fail.
import fs from 'fs';
import path from 'path';
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const attribution = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'assertion-attribution.json'), 'utf8'));
const caseFiles = fs.readdirSync(path.join(root, 'eval', 'cases-v2')).filter((f) => f.endsWith('.json'));
const cases = caseFiles.map((f) => JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', f), 'utf8')));
const CLASSES = new Set(['rule-targeted', 'base-capability', 'harm-guard']);

expect('every v2 case is attributed',
  cases.every((c) => attribution.cases[c.id]),
  `missing: ${cases.filter((c) => !attribution.cases[c.id]).map((c) => c.id).join(', ')}`);

expect('no attributed case has been deleted',
  Object.keys(attribution.cases).every((id) => cases.some((c) => c.id === id)),
  `stale: ${Object.keys(attribution.cases).filter((id) => !cases.some((c) => c.id === id)).join(', ')}`);

{
  const missing = [];
  const extra = [];
  for (const c of cases) {
    const entry = attribution.cases[c.id];
    if (!entry) continue;
    for (const a of c.assertions) if (!(a.id in entry.assertions)) missing.push(`${c.id}/${a.id}`);
    for (const id of Object.keys(entry.assertions)) {
      if (!c.assertions.some((a) => a.id === id)) extra.push(`${c.id}/${id}`);
    }
  }
  expect('every assertion of every case is attributed', missing.length === 0, missing.join(', '));
  expect('no attribution names an assertion the case does not have', extra.length === 0, extra.join(', '));
}

expect('every attribution uses a declared class',
  Object.values(attribution.cases).every((c) => Object.values(c.assertions).every((k) => CLASSES.has(k))));

expect('the declared classes are documented',
  [...CLASSES].every((k) => typeof attribution.classes[k] === 'string' && attribution.classes[k].length > 40));

// A case whose rubric is entirely rule-targeted cannot show the difference
// between a real effect and a flattering one — the comparison needs a
// contrast arm. 19 pre-existing cases have none, found by writing this
// pre-registration. They cannot be repaired: adding an assertion edits the
// case file, which changes caseSha256 and breaks the binding to run bundles
// already recorded against it. So they are listed and frozen, and the checks
// below make sure the list describes reality and never grows quietly.
{
  const listed = new Set(attribution.casesWithoutContrastArm.cases);
  const actual = Object.entries(attribution.cases)
    .filter(([, c]) => !Object.values(c.assertions).some((k) => k !== 'rule-targeted'))
    .map(([id]) => id);

  const unlisted = actual.filter((id) => !listed.has(id));
  expect('any new case carries a contrast arm (base-capability or harm-guard)',
    unlisted.length === 0,
    `entirely rule-targeted and not grandfathered: ${unlisted.join(', ')}`);

  const stale = [...listed].filter((id) => !actual.includes(id));
  expect('the grandfathered list holds no case that now has a contrast arm',
    stale.length === 0, `remove from the list: ${stale.join(', ')}`);

  expect('the grandfathered list says why it cannot simply be fixed',
    /caseSha256|binding/.test(attribution.casesWithoutContrastArm.note));
}

expect('the pre-registration records which cases already had runs',
  Object.values(attribution.cases).every((c) => /no-runs-existed=(true|false)/.test(c.registeredBefore)));

expect('the file states its own post-hoc caveat',
  /post-hoc/i.test(attribution.preRegistrationCaveat));
