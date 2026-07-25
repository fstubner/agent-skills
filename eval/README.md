# Unprimed eval

**Status: 2 recorded runs, case `okr-tool`, both negative.** See
`results/okr-tool-claude-code-claude-sonnet-5-r1.json` (Task-tool subagent)
and `-r2.json` (genuine top-level `claude -p` session). Both had all 15
skills installed from tag `v1.0.0-alpha.1`; neither invoked a single skill
on a prompt matching `product-build`'s own trigger. 1 of 5 criteria passed
in each run (`stack`) — the rest (`product`, `architecture`,
`designUxInterview`, `acceptanceSeparation`) failed because no skill fired
at all, not because a fired skill's guidance was wrong. Read both `notes`
fields before drawing conclusions — see the honesty rule in the root
README. Do not cite a passing checker-fixture test as evidence this
directory doesn't also apply to it.

## Protocol

1. Fresh session, empty project, skills installed from a tag, no priming
   (the case's `setup` block is the contract — violating it invalidates the
   run).
2. Paste the case `prompt` verbatim. Let the agent work.
3. Score each `scoring` criterion pass / fail / not_evaluated from the
   transcript. Scores are human judgment; keep the transcript so others can
   re-score.
4. Save as `results/<caseId>-<harness>-<model>-r<n>.json` matching
   `core/schemas/eval-result.schema.json` (CI validates shape, not truth).

A criterion you didn't observe is `not_evaluated`, not `pass`.
