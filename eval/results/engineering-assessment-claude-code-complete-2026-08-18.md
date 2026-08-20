# The claude-code half is complete: +39pp, and it cannot promote

Codex quota is out until 2026-08-20, so the contract's second cohort cannot
run. This finishes everything the available harness can give: three cases,
three conditions, three trials each, all at the current skill version
(`482b5534`, the post-hoist text).

```
node scripts/eval-report.mjs --cohort claude-code
```

| Case | skill | policy | control | delta vs policy |
|---|---|---|---|---|
| cited-risks | 71% | 29% | 29% | +43pp |
| retry-storm | 71% | 46% | 42% | +25pp |
| silent-drop | 75% | 25% | 33% | +50pp |
| **mean** | | | | **+39.3pp** |

95% confidence interval on the case-level deltas: **+7.3 to +71.3pp**. The
lower bound clears the contract's 10pp threshold, which is the substantive
result — but only just, on three cases, and the interval is enormous because
three is a small number of independent samples.

## Why this still says "not promotable"

`interim.promotable` is hard-coded `false`. The contract requires every
declared cohort, and a single-harness result is a partial one no matter how
good the numbers look. The flag exists so a blocked cohort does not stop
anyone reading a result already paid for, and so these numbers come out of
the same code path as the real ones instead of being recomputed by hand in a
markdown file.

The efficiency question from the previous run is also still open: the skill
arm costs 45-61% more than policy against a 10% requirement. Outcome
promotes; efficiency does not.

## Two bugs found while building this view

**Version selection by string sort.** The first implementation picked the
"latest" skill version by sorting the shas, and `legacy` sorts above a hex
digest — so it reported the pre-hoist runs as current, mean +36.1pp with a
tight interval. Recency now comes from the runs' own timestamps. The wrong
version produced a *better-looking* interval, which is the direction that
gets published without anyone checking.

**A missing trial.** retry-storm had only two skill trials at the current
version — the third was the API 529 excluded this morning. Re-run, 6/8, and
the matrix is now square.

## What completes this

Three commands per case on codex once quota returns, which fills
`requiredModelsByHarness.codex` and makes the real decision computable:

```
node scripts/eval-run.mjs --case <id> --condition <control|policy|skill> \
  --harness codex --model gpt-5.6-luna --codex-container
```
