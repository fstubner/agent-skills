# Unprimed eval — scaffold

**Status: scaffold. Zero recorded runs.** Until results exist in
`results/`, the suite makes **no measured claim** about improving agent
behavior — see the honesty rule in the root README. Do not cite this
directory as evidence of anything except that the harness exists.

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
