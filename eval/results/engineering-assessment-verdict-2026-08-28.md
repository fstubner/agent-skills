# The first complete verdict: no-demonstrated-win, by 0.0001

`engineering-assessment` is the first skill in this suite to complete its
evidence matrix. Four cases, three conditions, three trials each, both
harnesses — claude-code/haiku and codex/gpt-5.6-luna. 4 of 4 configured
cases complete.

**The contract says no.**

```
outcomeDelta      0.2892  (28.9pp over the policy baseline)
outcome CI lower  0.09989875691346586
threshold         0.1
costIncrease      0.5151  (95% CI 24.9% to 78.1%)
decision          no-demonstrated-win
```

## Outcome: short by one ten-thousandth

Every case is positive, and the mean effect is large:

| Case | delta vs policy |
|---|---|
| cited-risks | +40pp |
| silent-drop | +35pp |
| retry-storm | +26pp |
| job-ledger-ordering-assessment | +13pp |

The promotion rule is not the mean. It is the lower bound of the 95%
interval, which lands at **0.0998987…** against a threshold of **0.1**.

It misses by 0.0001 — one hundredth of a percentage point.

The temptation to call that "basically passing" is exactly what the bar
exists to refuse, and it is why the effect-size floors were added on
2026-08-18: a threshold you round toward when the result is close is not a
threshold. Four cases give a t-critical of 3.182, so the interval is wide
because the sample is small, not because the effect is doubtful. **A fifth
case is the legitimate way to settle this**, and it will settle it in
whichever direction is true.

## Cost: not close

The skill arm costs **51.5% more** than the policy baseline, interval 24.9%
to 78.1%. Against a contract wanting efficiency not to regress, that fails
on its own — outcome and efficiency are separate gates and this one is not
marginal.

So even a fifth case that carried the outcome interval over the line would
leave the skill unpromotable until it gets cheaper. That is a concrete
engineering target rather than a measurement problem: the skill is a
1,500-word document whose step 0 now requires running commands, and both
lengthen the run.

## What this run establishes

The machinery works. It took a skill with a large, reproducible,
cross-harness effect and declined to promote it, for two stated reasons,
with the numbers attached. Nothing in it was tuned after seeing the result.

That is worth more than a promotion would have been. A standard that only
ever says yes cannot tell you anything, and this one said no to the case its
author most wanted to pass.

## What would change it

1. **A fifth and sixth case.** Narrows the interval; the honest route.
2. **Make the skill cheaper.** 51.5% is the harder number, and it is about
   the skill's length and the work it mandates, not about the evidence.
3. **Nothing else.** Not the threshold, not the baseline, not dropping
   job-ledger — which contributed the weakest delta (+13pp) and is exactly
   the case a motivated reader would want to lose.
