# The promotion contract asks for an interval it does not fund

`freshCasesPerSkill: 3` and "95% CI lower bound above 0.1" were chosen
independently. Together they are far stricter than either looks.

Reproduce with `node scripts/eval-power.mjs`.

## The finding

At the case-level variance actually observed:

    pooled within-skill SD of case deltas   0.1338   (df = 4)
    95% upper bound on that SD              0.3174

    required cases to detect 2x the threshold at 80% power
      at the pooled estimate                15
      at the upper bound                    71

    configured freshCasesPerSkill            3

**At n=3, a mean delta below 0.432 can never clear the bar.** A skill would
have to lift the pass rate by 43 points to promote at the mandated sample size.
That is not a strict bar; it is an unstated one, and no skill has ever been
told it was being held to it.

## What this means for the one skill that finished

`engineering-assessment` has mean delta 0.273, SD 0.149, n=4 cases. Its
`no-demonstrated-win` verdict has been quoted all session as a finding about
the skill. It is not. It is a finding about the sample size: at n=4 the 95%
half-width is 0.237, nearly as wide as the effect being measured.

The same numbers say it would clear 0.1 at n=6 — but that figure is fitted to
its own result and must not be used as a target. The design figure is 15, and
15 is where a case count belongs.

## The budget is spent on the wrong axis

    within-cell SD across trials    0.110   (130 cells)
    between-case SD of deltas       0.134

Cases are the noisier axis and they are also the statistical unit — the
interval is computed over cases, not trials. The contract buys 18 runs per case
(3 conditions x 3 trials x 2 harnesses) to add one point to an n=3 sample.
Trials shrink a variance the interval barely sees.

At a fixed budget, more cases with fewer trials each is strictly better for the
question being asked. That is a contract change, not a code change.

## How the derivation avoids fitting the bar to the results

Sigma has to come from data; there is nowhere else to get it. The effect the
design must detect must not, or the exercise becomes choosing a case count that
makes a preferred skill pass.

So the design effect is stated as a rule — **detect twice what the contract is
willing to call a win** — and 2 x 0.1 = 0.2 does not move when a skill scores
well or badly. `--design-multiple` and `--power` make the choice explicit
rather than buried.

## Confidence in the number itself

Low, and the script says so. Sigma is estimated at df = 4, from two skills, one
of which contributes a single degree of freedom. The 95% upper bound on sigma
is 0.3174 — more than double the point estimate — and at that value the
required count is 71 rather than 15.

So "15 cases" is the current best estimate of an unstable quantity, not a
constant. It should be recomputed as more skills complete, which is why it is a
script and not a number written into `evidence.json`.

## One error caught in the derivation

The first version used one-sided t quantiles while `eval-report` computes a
two-sided interval, which understated the required count (12 rather than 15,
and 0.326 rather than 0.432 for the n=3 floor). A power calculation has to
describe the interval the gate actually computes. The table is now copied
deliberately from `eval-report.mjs` and commented as such.

## Not changed

Nothing in `eval/evidence.json`. Raising `freshCasesPerSkill` after seeing that
n=4 nearly passed has the same shape as reweighting a rubric after seeing which
assertions moved, even though this arithmetic is independent of any skill's
result. The number to raise it to should be argued from this derivation, agreed
in advance, and applied to skills not yet measured.
