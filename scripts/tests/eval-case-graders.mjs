// Every v2 case grader must discriminate at both ends: reject the adversarial
// fixture the case ships with, and accept an independently written fixture that
// conforms. A grader that only ever fails is as useless as one that only ever
// passes, and both look identical in a run report.
//
// Split out of eval-v2.mjs when that file crossed the 400-line gate. The case
// lists are the whole point of this file; keep the batch comments with them.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { expect } from './harness.mjs';

const root = path.resolve(import.meta.dirname, '..', '..');
const node = process.execPath;

const multiSkillCases = ['self-serve-project-invites', 'refund-ledger-rollout'];
for (const caseId of multiSkillCases) {
  const caseDefinition = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', `${caseId}.json`), 'utf8'));
  expect(`${caseId} names a unique multi-skill composition`,
    Array.isArray(caseDefinition.skills) && caseDefinition.skills.length >= 2
      && new Set(caseDefinition.skills).size === caseDefinition.skills.length
      && caseDefinition.skills.includes(caseDefinition.skill));
  const grader = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const reject = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'fixtures-v2', caseId)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader rejects the unfinished task fixture`, reject.status === 1, reject.stderr || reject.stdout);
  const accept = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'grader-fixtures-v2', `${caseId}-pass`)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader accepts an independent conforming fixture`, accept.status === 0, accept.stderr || accept.stdout);
}

const freshEfficacyCases = [
  'job-ledger-ordering-assessment',
  'zero-count-export-acceptance',
  // engineering-assessment's second and third cases. Promotion needs three
  // fresh cases per skill; the first, engineering-assessment-cited-risks,
  // has three trials per condition on claude-code as of 2026-08-18.
  'engineering-assessment-retry-storm',
  'engineering-assessment-silent-drop',
  // product-acceptance's third case: the gate returns SHIP and only an audit
  // finds the defects.
  'acceptance-clean-gate-dirty-code',
  // Measuring the two lifecycle additions: the operate half, and refusing a
  // stale replay log as runtime evidence.
  'operability-handover',
  'stale-replay-evidence',
  // frontend: extracting a design system from a drifted codebase. The
  // adversarial fixture scores 1/9 untouched and 3/9 for a token file that
  // transcribes all 31 literals — grounded at 100% and still not an
  // extraction, which is why coverage is reported and never gated.
  'design-system-drift',
  // release-engineering, batch 1 of the 15-case programme. One case per
  // numbered rule: build once and promote (1), inject config at deploy (3),
  // a rollback an operator can run without a lookup (4).
  'rebuild-per-environment',
  'secrets-baked-into-image',
  'rollback-by-recollection',
  // Batch 2, continuing one case per numbered rule: cheap checks gate before
  // expensive ones (2), the flag decision is recorded rather than assumed (5),
  // and a deploy is not done until its health is observed (7).
  'gate-order-inverted',
  'flag-decision-unrecorded',
  'deploy-declared-done-at-exit-zero',
  // Batch 3. Rule 6 (a contraction that quietly makes the documented rollback
  // unusable), and two cases sitting under rules 2 and 7 respectively: a gate
  // that cannot fail the pipeline, and a health check that cannot report bad
  // news for the gate above it to act on.
  'migration-blocks-rollback',
  'gate-that-does-not-gate',
  'health-check-always-ok',
  // Batch 4. Rule 8's honesty clause, the check-smoke paragraph's own origin
  // story, and rule 4's second half — the rollout shape chosen from what kind
  // of wrong the change can be.
  'runbook-of-guesses',
  'declared-commands-point-nowhere',
  'all-at-once-for-a-quiet-risk',
  // release-engineering's fifteenth and last. Rule 1 is already satisfied —
  // one image, promoted by digest — and the artifact is still three different
  // programs, because the code inside it branches on the environment's name.
  'environment-branching-in-the-artifact',
  // product-acceptance: the project's own documents carry instructions aimed
  // at the acceptor, and the state one of them rules out of scope is where the
  // defect is.
  'documents-instruct-the-acceptor',
  // Every contract document was read off the implementation, so all of them
  // agree with it and none of them is evidence. The actual request is in the
  // repository and asks for something the product does not do.
  'intent-reconstructed-from-code',
  // The builder's plan, checklist and "production-ready" status paragraph are
  // in the repository. Two of the four self-review claims are false, and
  // reading them at all forfeits the independence assertion.
  'builder-self-assessment-in-the-repo',
  // A good argument for narrowing the audit, which fails on the one condition
  // the skill will not trade — the diff touches an auth path — and the defect
  // is inside the three files being waved through.
  'narrowed-audit-across-a-trust-boundary',
];
for (const caseId of freshEfficacyCases) {
  const grader = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const reject = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'fixtures-v2', caseId)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader rejects the adversarial task fixture`, reject.status === 1, reject.stderr || reject.stdout);
  const accept = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'grader-fixtures-v2', `${caseId}-pass`)], { cwd: root, encoding: 'utf8', timeout: 30_000 });
  expect(`${caseId} outcome grader accepts an independent conforming fixture`, accept.status === 0, accept.stderr || accept.stdout);
}

const freshScreenCases = ['retry-delay-regression-suite', 'json-config-setter', 'project-label-library'];
for (const caseId of freshScreenCases) {
  const caseDefinition = JSON.parse(fs.readFileSync(path.join(root, 'eval', 'cases-v2', `${caseId}.json`), 'utf8'));
  expect(`${caseId} remains a single-skill efficacy case`, !('skills' in caseDefinition));
  const grader = path.join(root, 'eval', 'graders-v2', `${caseId}.mjs`);
  const reject = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'fixtures-v2', caseId)], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  expect(`${caseId} outcome grader rejects the unfinished task fixture`, reject.status === 1, reject.stderr || reject.stdout);
  const accept = spawnSync(node, [grader, '--root', path.join(root, 'eval', 'grader-fixtures-v2', `${caseId}-pass`)], { cwd: root, encoding: 'utf8', timeout: 60_000 });
  expect(`${caseId} outcome grader accepts an independent conforming fixture`, accept.status === 0, accept.stderr || accept.stdout);
}
