# Subagent arms are not isolated, and one wandered off the fixture

Second attempt at the `engineering-assessment` comparison, after the Codex
quota ran out. Claude haiku subagents instead of a CLI harness, on
workspaces staged byte-identically to what `eval-run.mjs` produces —
fixture copied, `.agent-input/engineering-assessment/` staged for the skill
arm, the same verbatim prompt for each condition.

## Result: one arm usable, one contaminated, no comparison

| Arm | Harness | Grader | Usable? |
|---|---|---|---|
| control | codex gpt-5.6-luna, container | 2/5 | yes — a real v2 bundle, from the earlier run |
| skill | claude haiku subagent | 2/5 | scored, but not comparable — different model *and* harness from the control |
| policy | claude haiku subagent | 0/5 | **no — it assessed the wrong codebase** |

The policy arm wrote an assessment of **this repository**: nine references
to `registry.json`, `eval/README.md`, "17 skills", `check-backend`, and CI
running on Ubuntu and Windows. Zero references to any file in the fixture.
Its opening line is `# Engineering Assessment: agent-skills v1.0.0-alpha.22`.

The skill arm stayed inside the fixture — eight citations to
`src/server.js`, `src/files.js` and `003_remove_audit.sql` — so the
wandering is not universal, which makes it worse rather than better: the
same setup produces isolated and non-isolated runs unpredictably.

## Why this happens, and what it means for the method

A Task subagent inherits the session's environment. Nothing confines it to
a directory: the working directory is a *sentence in its prompt*, not a
boundary. `eval-run.mjs` does not rely on a sentence — it copies the
fixture into a temp workspace and launches the harness with `--cd`, plus
`--sandbox workspace-write` for Codex or a container mount.

So **subagents cannot substitute for the CLI harness on isolation
grounds.** They can execute the same prompt, and one of them did, but
whether a given run stayed in scope is discovered afterwards by reading its
output — which is not a property an evaluation system can rest on.

The v2 runner already understands this class of problem: it has an
`ambientSkillAccess` check that voids a control or policy arm which touched
an installed skill. The subagent path bypasses that check entirely, because
nothing about a subagent run passes through the runner.

## The narrower finding, stated carefully

The skill arm's 2/5 has a different *shape* from the control's 2/5. The
control passed `false-green-detected` and `tooling-evidence`; the skill arm
passed `ranked-actionable-findings` and `coverage-honesty`, and moved
citation validity from 0 of 3 planted risks to 2 of 3 within an assertion
it still failed.

That pattern is suggestive — those are the things the skill's rules are
actually about — and it is **not evidence**, because the two arms differ in
model and harness as well as condition. Recording it here so the
observation is not lost, and labelled so it cannot be cited as a result.

## What would produce a real comparison

An authenticated `claude-code` CLI session, or Codex quota after
2026-08-20. Either runs all three arms through `eval-run.mjs` on one model,
with isolation the runner enforces rather than requests.

If subagent arms are ever wanted as a supported path, they need a
scope check before scoring: does the deliverable cite files that exist in
the fixture? The policy arm scores 0/5 either way, but 0/5 and "this run
never looked at the subject" are different facts, and only one of them is
about the skill.
