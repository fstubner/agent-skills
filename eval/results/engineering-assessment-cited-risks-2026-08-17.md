# Splitting one assertion made the difference visible

`engineering-assessment-hidden-risks` scored every arm 2/5 — control,
policy, and two skill trials — while the skill arms cited two of the three
planted risks with valid file-and-line evidence and the others cited none.
`planted-risks-cited` was all-or-nothing across the three, so 0 of 3 and 2
of 3 both read as one failed assertion.

Split into one assertion per planted risk, re-graded against the same saved
outputs (no model runs — the deliverables were already on disk):

| Arm | Old case | New case | Passed |
|---|---|---|---|
| control (codex gpt-5.6-luna) | 2/5 | **2/7** | false-green-detected, tooling-evidence |
| policy (haiku subagent) | 2/5 | **2/7** | false-green-detected, tooling-evidence |
| skill (haiku subagent) | 2/5 | **4/7** | + default-credential-cited, path-traversal-cited |

The separation the old case could not express: the skill arm reports the
hard-coded admin fallback at `src/server.js:5` and the unbounded path join
at `src/files.js:6`, both with citations that resolve. Control and policy
name neither at a checkable location. All three miss the destructive
migration.

## Why this is a sibling case, not a revision

Editing the original in place was the obvious move and the wrong one. A
case's SHA-256 is recorded in every run bundle, so changing it retires every
run made against the old text — **fifteen bundles here**, thirteen of them
from earlier sessions, and `scripts/eval-screen.mjs` refers to specific run
ids among them, so the screen broke too. That is the retirement mechanism
working as designed; it is simply expensive when a case already has history.

So `engineering-assessment-cited-risks` is a new case at revision 1, sharing
the fixture and prompt, with its own grader. The original keeps its
assertions, its fifteen bundles, and its place in the screen.

## Standing

Still not evidence. One control run on codex, one policy and one skill run
via haiku subagents, so condition is confounded with harness and model, and
the promotion bar is three cases × three trials × two harnesses. What the
re-grade establishes is narrower and worth having: **the case can now
register the thing the skill actually changed.** Before the split it could
not, which meant a null result from it would have been uninformative rather
than negative.
