# Correction: the four "null" results are UNDERPOWERED, not disproven

Written 2026-08-02, same day as the batches it corrects. Supersedes the
"NULL (ceiling)" framing in `five-skill-batch-2026-08-02.md` and
`full-suite-batch-2026-08-02.md` for the four skills below.

## The error

Those batches reported `mental-models`, `code-smells`, `testing-strategy`
and `ai-prose-slop` as showing zero lift, and I drew a conclusion from it:
that skills restating "model-native judgment" earn no place. That
conclusion is not supported by the evidence I actually collected, because
**for at least two of the four, the eval task tested the opposite of the
skill's stated trigger.**

| Skill | Its stated trigger | What I actually tested |
|---|---|---|
| code-smells | "when a change touches the same handful of files every time" — shotgun surgery, a MULTI-FILE, TEMPORAL pattern | One 60-line file with four obvious planted smells. Zero multi-file signal, no change history at all. |
| mental-models | "when a problem's cause isn't obvious", "an ambiguous goal with no clear starting decomposition" | A plan with three obvious flaws and an unambiguous right answer. |
| testing-strategy | test-pyramid triage, flaky-suite discipline, pinning the specific cause of a failure | Writing tests for one small pure function, then one small async function. Never a suite to triage, never a flaky test. |
| ai-prose-slop | detect and edit AI-prose tells | This one is closer to fair — two prompt designs, both null. But the null is on the EDITING guidance; the Vale rules are deterministic and do work. |

A null result on a task the skill says it is not for measures nothing
about the skill. It measures that haiku spots obvious problems in small
inputs, which was never in question.

## What this does and does not change

- **Does not change:** the positive results. Those tasks matched their
  skills' triggers, and the artifacts they produced were verified
  deterministically. `frontend`, `product-acceptance`,
  `product-management`, `release-engineering`, `code-organization`,
  `backend-engineering`, `systems-architecture`, `cli-tooling` stand.
- **Does not change:** the two defects the evals found in `data-modeling`
  and `engineering-assessment`. Those were real failures on tasks that DID
  match the trigger, and both are fixed and retested.
- **Does change:** the four skills above move from "measured zero" to
  **untested**. No cut, no merge, no downgrade is justified on this
  evidence.
- **Does change:** the generalisation I drew — "artifacts and gates carry
  the lift, judgment prose adds nothing" — is withdrawn. It may still be
  true. It is not something these runs established.

## What a valid test looks like for each

- **code-smells:** a repo with real (or synthesised) commit history where
  one conceptual change repeatedly touches 5+ files across unrelated
  directories. Score: does the reviewer identify the shotgun-surgery
  pattern and name the missing seam, or only list per-file tidiness?
- **mental-models:** a problem with a plausible-but-wrong obvious cause
  and a non-obvious real one, where the evidence to distinguish them is
  available but must be sought. Score: were competing hypotheses
  enumerated and discriminating evidence named, or was the first
  explanation accepted?
- **testing-strategy:** an existing suite of 100+ tests, some flaky, some
  testing implementation detail. Score: correct triage decisions, not
  "did it write tests".
- **ai-prose-slop:** the judgment-only patterns (the ones with no Vale
  rule) on text where the deterministic rules do not fire.

## Process lesson

The eval protocol needs a precondition it did not have: **the task must
match the skill's own stated trigger, and that match must be argued in the
result file before the run.** Every one of these four failed that check,
and nothing in the protocol caught it because the protocol never asked.
Added to the standard for future batches.
