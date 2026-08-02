# Trigger-matched batch — 2026-08-02

Re-runs of the three skills whose earlier nulls were
[underpowered](./CORRECTION-2026-08-02-underpowered-nulls.md). Each task now
matches the skill's own stated trigger, per the precondition added to
`../README.md`. Haiku-4.5 Task-tool subagents, n=1 per arm.

## What each task exercises, argued before scoring

| Skill | Trigger clause | How this task hits it |
|---|---|---|
| mental-models | "when a problem's cause isn't obvious" | An obvious suspect (a widget shipped 20 min before the spike, which everyone blames) that the evidence exonerates, and a real cause (an index dropped on a `pg_stat` reading taken while its main consumer was paused) reachable only by cross-referencing four attachments. The previous task had three obvious flaws and one right answer. |
| code-smells | "when a change touches the same handful of files every time" | A real git repo, 22 commits each adding one order field and touching all four layers to do it. Multi-file and temporal — invisible in any single file. The previous task was one 60-line file. |
| testing-strategy | suite triage, flaky discipline, pinning cause | An existing green 10-test suite with a wall-clock flake, an implementation-detail test, seven near-duplicates, and two real escaped bugs. The previous task was writing tests for one pure function. |

## Results

| Skill | Result | Control | Forced |
|---|---|---|---|
| **mental-models** | **positive, on process** | Reached the index, ruled out the widget, cited the stale `pg_stat` — but no enumerated candidates, no record. 317 words. | Same conclusion **plus** enumerated candidates with discriminating evidence, explicit ruled-out, and the full reasoning record including what would make the conclusion wrong. 448 words. |
| **code-smells** | **positive** | Found the four layers and proposed consolidation, but never named shotgun surgery and **never looked at history** — a snapshot review of a history-shaped defect. 1154 words. | Named shotgun surgery explicitly and used the commit history to argue it. 1083 words — shorter and more specific. |
| **testing-strategy** | **null (genuine)** | All six planted problems found: flake, implementation-detail test, redundancy, both escaped bugs, the vacuous assertion. 449 words. | Same six. 958 words. |

## Reading these honestly

**mental-models is no longer untested, but the win is narrow and worth
stating precisely.** Both arms got the right answer — haiku is good enough
at this that the skill did not change the conclusion. What the skill
changed is whether the reasoning is *inspectable*: the control asserts, the
forced arm shows candidates, discriminating evidence, and a falsification
condition. That is exactly what the reasoning record was added for
(alpha.12), and it is the first evidence it does what it was meant to. It
is also a weaker claim than "the skill finds better answers", and should
not be reported as one.

**code-smells is the clearest result in this batch.** The control did a
competent snapshot review and structurally could not find the defect,
because the defect is not in the snapshot. The forced arm read history and
named the pattern. This is what the earlier eval was incapable of showing:
the skill only had the capability at all as of `check-cochange.js` the same
day, and the earlier task could not have exercised it.

**testing-strategy is a real null now, not an artefact.** The task matched
the trigger — an existing suite to triage, a flake, escaped bugs — and both
arms found all six problems. The forced arm was twice as long for the same
findings. On this evidence the skill's content is within haiku's unprompted
competence at this scale. The honest next question is whether scale is the
variable (a 200-test suite, a flake that only appears under parallelism)
or whether the skill genuinely restates what the model already does.

## Caveat that applies to all three

n=1 per arm. `ai-prose-slop` was not re-run: its judgment-only patterns are
the untested part, and a fair task needs prose where the Vale rules do not
fire at all — not built yet.

One arm had to be re-run: the first `mental-models` forced attempt returned
its analysis in the reply instead of writing the file. Scored only the
re-run, since scoring a transcript is not scoring an artefact.
