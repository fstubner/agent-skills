# What a harm-guard measurement would need

Date: 2026-09-03. Derived by `scripts/eval-power-harm-guards.mjs`, after an
attempted fix to a measured harm-guard regression produced a result the
instrument could not interpret.

## The binding constraint is resolution, not sample size

A case's harm-guard rate is (assertions passed) / (assertions), averaged over
trials. With A assertions and T trials it can only land on multiples of
1/(A·T).

Nine of engineering-assessment's ten harm-guard cases carry **one** assertion;
the tenth carries two. At three trials, the only reachable values are 0, ⅓, ⅔
and 1.

**The smallest non-zero change a case can report is 33 points.** The regression
being chased is 10. It is not a small effect that needs more samples — at this
rubric density it is unrepresentable, and no number of cases changes that.

That also explains the −33pp entries in the fix attempt: each is one trial
flipping a single binary check.

## The numbers

| | engineering-assessment | product-acceptance |
|---|---|---|
| cases carrying harm guards | 10 | 5 |
| assertions per case | 1–2 | 1 |
| finest change a case can show | 33pp | 33pp |
| assertions needed for 10pp | **4** (→ 8.3pp resolution) | 4 |
| observed paired spread (SD) | 0.186 | no re-measurement |
| cases needed at that spread | **27** | — |
| detectable today, at 10 cases | nothing below **13pp** | — |

The effect size to detect is not fitted to the data: it is
`outcomeDeltaRequired`, the 0.1 the contract already calls a meaningful outcome
win. Detect a regression as large as a gain you would celebrate. Sigma comes
from data because there is nowhere else to get it, which is the same split
`eval-power.mjs` uses.

## The case count is an upper bound

27 is derived from a spread measured at 33pp resolution, and most of that
spread *is* the quantisation. A one-trial flip on a single binary check reads
as a 33-point swing whether or not anything real changed. Adding assertions
shrinks the step and the spread together, so the count should be re-derived
once the rubrics carry enough guards to measure with — not treated as 27 cases
of new work.

## What this implies

Four harm-guard assertions per case, against one or two today, across the ten
cases that carry them. That is rubric work on existing cases, not new cases.
The obvious risk is writing four checks that all fire together, which buys
resolution on paper and none in practice; they have to be able to fail
independently.

Then re-derive the case count, and only then retry a fix. Any attempt before
that is guesswork against a 26-point error bar, which is exactly what the last
one was.

## The same question is open for the outcome comparison

`base-capability` assertions are saturated at 1.000 in both arms for two of
three measured skills, so the circularity contrast carries no information
either. That is a separate finding
(`attribution-split-2026-09-03.md`) with the same shape: an assertion class
that cannot vary is not measuring anything. Both need rubric work before more
runs are worth buying.

## Reproducing

```bash
node scripts/eval-power-harm-guards.mjs
node scripts/eval-power-harm-guards.mjs --skill engineering-assessment --detect 0.05
```
