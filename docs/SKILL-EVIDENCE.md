# What each skill has actually been shown to do

One row per skill. "Checker" means a deterministic script whose report the
acceptance gate reads. "Evidence" means a recorded eval in `eval/results/`
with a control arm, not an argument for why the skill should help.

This file exists because the honest answer to "is this skill worth its
place" is different for every row, and a suite that cannot say which is
which is asking its users to take seventeen things on faith.

| Skill | Checker | Evidence | Reading |
|---|---|---|---|
| product-acceptance | yes | positive — a planted stale report is re-derived, self-SHIP is unreachable | Load-bearing. The gate. |
| backend-engineering | yes | positive — secret in a client path blocks; session-cookie flags block | Load-bearing, though the oncall build shows sonnet already complies unprompted on a small app. |
| systems-architecture | yes | positive — missing/empty ARCHITECTURE.md blocks | Load-bearing. The most frequent discriminator between arms. |
| frontend | yes | positive — contrast bracketed at 4.5:1, dual-framework blocks | Load-bearing. |
| code-smells | yes | **positive, strongest** — control did a snapshot review and structurally could not find a history-shaped defect; forced arm read the git log and named shotgun surgery | Earns its place on merit. |
| code-organization | yes | positive — import cycles detected, type-only imports correctly ignored | Load-bearing. |
| data-modeling | yes | positive — destructive migration blocks | Load-bearing. |
| release-engineering | yes (new) | the defect it was written for is on record: a shipped `test` script pointing at a missing directory | New; the checker is evidence-driven, the rest of the skill is not. |
| ai-prose-slop | yes | partial — Vale integration verified; the judgment-only patterns are untested | Standalone utility. |
| mental-models | no | positive on process — same conclusion in both arms, but only the forced arm enumerated candidates and stated a falsification condition | Narrow, real, and weaker than "finds better answers". |
| product-build | no | positive on one axis — the injection stance turned a rationalized compliance into a surfaced finding | The dispatcher. Its gate half is unmeasured. |
| product-management | no | none | Untested. |
| testing-strategy | no | **measured null** — both arms found all six planted problems; forced was twice as long for it | Has not earned its place yet. |
| cli-tooling | no | positive — control shipped no `--help` and no tests; forced shipped both | Small but real. |
| engineering-assessment | no | none, and it is the **most-invoked skill in field telemetry** (7 calls, 12 days) | Untested, and first in line for a v2 case — this is the one people reach for. |
| learn-from-session | no | none | Untested. |
| multi-agent-design | no | none | Untested. |

Field usage over twelve days
([field-telemetry-2026-08-16.md](../eval/results/field-telemetry-2026-08-16.md))
is a separate axis from either column and cuts across the reading above:
`engineering-assessment` 7 calls, `ai-prose-slop` 4, `product-acceptance` 4,
`frontend` 3, `release-engineering` 1, everything else 0. The log cannot say
who initiated a call, so it ranks attention, not efficacy.

## What follows from this

Four skills have never been measured at all, and one has been measured and
found to make no difference. The temptation is to cut them, and that is as
unprincipled as keeping them: absence of evidence here is absence of
measurement, not evidence of absence.

So the order is measure, then cut:

1. `testing-strategy` has the only negative result. Re-run it at a scale
   where the advice could bite — a suite large enough that triage order
   matters, a flake that only appears under parallelism. If it is null
   again, fold what survives into `code-smells` and drop it.
2. `engineering-assessment` first — most-used, least-measured.
   `product-management`, `learn-from-session` and `multi-agent-design` need
   one trigger-matched A/B each after it. The precondition
   in `eval/README.md` applies: the task must match the skill's own stated
   trigger, or the null is an artefact of the task.
3. Anything still null after a fair test goes.

Routing table length is the cost being paid. Seventeen entries compete for
the same attention, and on a real build the whole table produced zero
invocations.
