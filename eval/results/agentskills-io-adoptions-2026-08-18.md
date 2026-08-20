# Two adoptions from agentskills.io, and a bug they exposed

[Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills)
prescribes two things this suite lacked. Both are now implemented as
diagnostics that sit beside the promotion decision rather than inside it.

## 1. Assertions that pass in both arms

Their rule: *"Remove or replace assertions that always pass in both
configurations… They inflate the with-skill pass rate without reflecting
actual skill value."*

We had several — control and skill both citing the unbounded retry loop 3/3,
both citing the discarded error 3/3. Haiku finds visible bugs unaided.

Rather than delete them from the cases — which would change each case's
SHA-256 and retire the 27 runs they were graded under — `eval-report.mjs`
now classifies every assertion per experiment as **discriminating**,
**undiscriminating** (passes in every control *and* every skill trial) or
**unreachable** (fails everywhere), and reports an outcome rate over the
discriminating subset alongside the full one.

Post-hoist skill version, claude-code/haiku:

| Case | full rubric | discriminating only |
|---|---|---|
| cited-risks | 29% → 71% (+42pp) | **0% → 60% (+60pp)** |
| retry-storm | 42% → 69% | no undiscriminating assertions |
| silent-drop | 33% → 75% | no undiscriminating assertions |

The promotion metric deliberately still uses the **full** rubric. Dropping
assertions after seeing which ones flatter the result is how a bar gets
moved to fit the data; the diagnostic surfaces the inflation without acting
on it, and the guidance applies to *writing the next case*, not rescoring
this one. A test pins that boundary.

## 2. Blind holistic judging

Their tip: present both outputs to a judge without revealing which came from
which version. `scripts/eval-judge.mjs` does that — five dimensions
(actionability, evidence, prioritisation, honesty, readability), JSON
verdict, written to `eval/judgements/` and marked `evidentiary: false`.

Which run becomes "Report A" is a hash of the two run ids, so the assignment
is stable across re-runs. A random flip would make a rerun look like a
changed verdict.

Skill against control, one pair per case:

| Case | winner | skill total | control total |
|---|---|---|---|
| silent-drop | skill (as A) | 22 | 14 |
| retry-storm | skill (as A) | 25 | 15 |
| cited-risks | skill (as B) | 22 | 16 |

The skill arm wins all three, and wins from both letter positions — so this
is not simple position bias. An independent signal agreeing with the
deterministic assertions is worth more than either alone.

## The bug this exposed

Adding per-assertion diagnostics surfaced something the summary numbers had
hidden: **skill runs from before and after yesterday's SKILL.md edit were
being pooled into one cell.** Six "skill" trials of a case were three trials
each of two different skills, averaged into a version that no longer exists.

`stagedInputSha256` existed by then but nothing keyed on it. The cell key now
includes it, and an experiment is a case/harness/model block *at one staged
input version*, with control and policy — which stage nothing — shared
across versions rather than duplicated. The first attempt at this silently
dropped the legacy runs instead of splitting them; the fix keeps both, which
is why the table above can show pre- and post-hoist separately at all.

## Where their guidance is wrong for this harness

They write that in Claude Code, subagent isolation *"comes naturally: each
child task starts fresh."* Measured here yesterday: a fresh context is not a
filesystem boundary. A policy-arm subagent read out of the parent repository
and assessed the wrong codebase entirely, and only a hardened scope preamble
plus an after-the-fact citation check caught it. See
[subagent-arms-2026-08-17.md](./subagent-arms-2026-08-17.md).
