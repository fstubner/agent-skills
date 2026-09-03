// A pre-registered contract may be amended, but never silently.
//
// evidence.json floors the things that make a promotion claim meaningful:
// fifteen cases, three trials, the three conditions, a policy baseline, 95%
// confidence, and two harnesses. eval-verify refuses any weakening of those.
//
// The second harness was the one floor that named a specific tool for a
// general purpose. A second harness exists to test whether an effect
// generalises past the model it was measured on; codex/gpt-5.6-luna was how
// that was to be done, until the account's quota ran out and the arm became
// unrunnable. Swapping it is legitimate. Swapping it quietly is not — a
// contract that can be edited without trace is not pre-registration.
//
// So the rule is: claude-code stays (the completed arm is on it, and dropping
// it would discard the only evidence there is), there are always at least two
// harnesses, every required harness names a model cohort, and dropping codex
// requires a contractAmendments entry that says so.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { expect, tmpBase } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'evidence.json'), 'utf8'));

// eval-verify reads a whole eval root, so each variant gets one with its own
// evidence.json and the real cases and runs beside it. Only evidence.json is
// copied; cases and runs are symlink-free reuse via --eval-root on the real
// tree would rewrite it, so the variant tree carries copies of the small
// directories and an empty runs dir. The contract checks fire before any run
// is read, which is what this test exercises.
function verdictFor(mutate) {
  const evalRoot = fs.mkdtempSync(path.join(tmpBase, 'contract-'));
  fs.mkdirSync(path.join(evalRoot, 'runs'));
  fs.cpSync(path.join(root, 'eval', 'cases-v2'), path.join(evalRoot, 'cases-v2'), { recursive: true });
  const evidence = JSON.parse(JSON.stringify(source));
  mutate(evidence);
  fs.writeFileSync(path.join(evalRoot, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'eval-verify.mjs'), '--eval-root', evalRoot],
    { cwd: root, encoding: 'utf8' });
  return `${r.stdout}${r.stderr}`;
}

const unchanged = verdictFor(() => {});
expect('the contract as it stands passes its own floors',
  !/required harness|second harness|model cohort/.test(unchanged), unchanged.slice(0, 300));

const noEntry = verdictFor((e) => { delete e.contractAmendments; });
expect('dropping codex without an amendment entry fails',
  /no contractAmendments entry/.test(noEntry), noEntry.slice(0, 300));

const unrelatedEntry = verdictFor((e) => {
  e.contractAmendments = [{
    date: '2026-09-03',
    change: 'costRates updated for a new published rate card, nothing else touched.',
    reason: 'A rate card changed, which moves no floor and no requirement at all.',
    independentOfResults: true,
  }];
});
expect('an amendment about something else does not license the swap',
  /no contractAmendments entry/.test(unrelatedEntry), unrelatedEntry.slice(0, 300));

const oneHarness = verdictFor((e) => { e.minimumEvidence.requiredHarnesses = ['claude-code']; });
expect('dropping to a single harness fails even with an amendment',
  /a second harness is required/.test(oneHarness), oneHarness.slice(0, 300));

const noClaude = verdictFor((e) => {
  e.minimumEvidence.requiredHarnesses = ['antigravity', 'codex'];
});
expect('removing claude-code fails: the completed arm is on it',
  /required harness claude-code was removed/.test(noClaude), noClaude.slice(0, 300));

const noCohort = verdictFor((e) => { delete e.minimumEvidence.requiredModelsByHarness.antigravity; });
expect('a required harness with no model cohort fails',
  /model cohort for antigravity was removed/.test(noCohort), noCohort.slice(0, 300));
