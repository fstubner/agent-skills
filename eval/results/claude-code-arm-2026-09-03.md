# The claude-code arm, complete: 45 cases, 3 conditions, 3 trials each

Date: 2026-09-03. Harness `claude-code`, model `claude-haiku-4-5-20251001`.
Every case of every measured skill has three trials in each of control, policy
and skill, and every trial counted here is one `eval-report` accepts.

## This is not a promotion verdict, and eval-report does not offer one

`eval-report` reports **insufficient-evidence** for all three skills, and it is
right to. A case comparison requires every cohort the contract lists, the
contract lists two harnesses, and the codex arm has not run. So
`completedCaseCount` is near zero and no claim is promotable.

What follows is the one-harness picture, computed from the report's own
per-experiment output. It is a real measurement of a real matrix. It is not
the bar the suite set for itself.

## Result

Baseline is the **policy** arm — a concise statement of the same rules, not an
empty control — so this asks whether the skill's full text beats a short
policy, which is the harder and more honest comparison. Control is a bare
prompt.

| skill | vs policy | 95% CI | vs control | ahead on | cost vs policy |
|---|---|---|---|---|---|
| engineering-assessment | **+21.0pp** | [13.4, 28.7] | +26.4pp | 14/15 | +59% |
| product-acceptance | +9.3pp | [2.7, 16.0] | +17.9pp | 10/15 | +57% |
| release-engineering | +10.4pp | [1.8, 19.1] | +8.4pp | 10/15 | +8% |

All three intervals exclude zero: on this harness the skills beat a concise
policy statement of the same rules, and beat a bare prompt by more.

Only `engineering-assessment` clears the contract's own bar — a 95% lower
bound above 0.1 — on this harness alone, at 13.4pp. The other two are
positive with lower bounds of 2.7 and 1.8pp: real, and smaller than the
threshold the suite declared meaningful before running anything.

The cost column is the part to weigh. `engineering-assessment` and
`product-acceptance` cost roughly 58% more than the policy arm for their
gain; `release-engineering` costs 8% more for a comparable one.

### Where the skills lose

Seven case-level losses across the three skills, all small:

- `secrets-baked-into-image` −8.3pp, `migration-blocks-rollback` −7.4pp,
  `declared-commands-point-nowhere` −4.2pp (release-engineering)
- `block-softened-into-prose` −6.1pp, `acceptance-clean-gate-dirty-code`
  −4.2pp, `checker-crash-read-as-pass` −3.7pp (product-acceptance)

`severity-inflation-pressure` is the one engineering-assessment case at
exactly 0.0pp. None of these has been investigated; each is a place where the
skill text is no better than a paragraph of policy, and the previous time a
loss was investigated it turned out to be a grader defect rather than a real
one.

## Two counting bugs found by generating this

Both were the same shape: the batch runner's idea of a filled cell differing
from the report's idea of a usable run, so the runner reported the arm
finished when it was not.

1. **Quota failures counted as trials** (fixed 2026-09-02, `3c7d30c`). The
   session limit tripped mid-batch; 158 runs returned "429 session limit" in
   about three seconds each with nothing evaluated. Three batch commits
   claimed "completed 100, failed 0".
2. **Truncated runs counted as trials** (fixed today). With the first fixed
   and the runner reporting 0 outstanding, the report still had two cases at
   14 of 15. A run cut off by `API Error: Server error mid-response` exits
   non-zero with tokens billed and a *complete grading* — 2 passed, 9 failed —
   scored against an answer that stopped early. Grading a truncated answer is
   not a measurement.

`eval-batch` now mirrors `runEligibility()` from `eval-report.mjs` on the two
conditions a manifest can carry, and `scripts/tests/eval-batch.mjs` pins both
halves with a bundle that exits 0 with nothing evaluated — without which the
`notEvaluated` half tested nothing, since the other fixtures exit non-zero.

## What was excluded, and what is not known

- 163 bundles from the 429 window and 13 harness-exit-1 bundles are on disk,
  excluded from every figure here. They are records of a quota event and of
  truncations, not results.
- Two cases carry an older skill-version experiment each; the newest version
  wins and the older is dropped. Using the report's looser
  `observedComparisons` list instead would have counted those twice and put
  engineering-assessment at 22.6pp over 17 "cases".
- **One harness, one model.** Nothing here says whether these effects survive
  on codex/gpt-5.6-luna. That is the whole remaining question, and it costs no
  Claude quota to answer.
- Cases are the unit; three trials per cell is thin for estimating a
  per-case rate, and the interval above treats each case's rate as exact.
- The graders are the instrument, and five separate defects in them were
  found and fixed in the four days before this run. There is no reason to
  think the sixth does not exist.

## Reproducing

```bash
node scripts/eval-report.mjs
node scripts/eval-batch.mjs --harness claude-code --dry-run
```
