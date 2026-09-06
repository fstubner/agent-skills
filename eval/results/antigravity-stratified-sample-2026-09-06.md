# A stratified sample instead of the full second arm

2026-09-06. **Written before the runs, so the selection cannot be tuned to
the result.**

## Why not just finish the arm

The antigravity cohort needs 410 runs to complete. 73 of them exist, covering
8 cases, and they already suggest the thing the full arm would be spent
proving: the skills help claude-code (haiku) and do not help
antigravity (gemini-3.6-flash-low).

Over the 7 cases where both harnesses were complete at the time:

| | mean skill − policy |
|---|---|
| claude-code | +10.2pp |
| antigravity | -4.1pp |

Spending 337 more runs to confirm a null is a poor trade when a smaller
sample can test the same question. If the sample shows the same pattern, the
full arm changes nothing. If it does not, the full arm becomes worth running
and this sample says where to look.

## The selection, and why it is not cherry-picked

The 8 cases already run were chosen by the batch runner's alphabetical order,
which left coverage lopsided — product-acceptance 5, engineering-assessment 2,
release-engineering 1. A conclusion drawn from that would be a conclusion
about product-acceptance wearing all three skills' clothes.

Six more cases, stratified to even that out (final coverage 6/4/4):

    release-engineering     declared-commands-point-nowhere
    release-engineering     environment-branching-in-the-artifact
    release-engineering     gate-order-inverted
    engineering-assessment  engineering-assessment-cited-risks
    engineering-assessment  stale-docs-versus-code
    product-acceptance      intent-reconstructed-from-code

Chosen by sorting each skill's not-yet-run cases on
`sha256("antigravity-stratified-sample-2026-09-06" + caseId)` and taking the
first N. The seed is fixed, the rule is reproducible, and neither depends on
any outcome — the same command run before or after the results returns the
same six. This matters because every alternative I could have used (pick the
cases with the biggest claude-code effect, pick the ones that looked
promising) selects on the answer.

54 runs.

## What this sample can and cannot settle

It **can** show whether the negative antigravity result survives outside the
alphabetically-early product-acceptance cases, and whether release-engineering
— which currently has one case and no real coverage — behaves differently.

It **cannot** promote anything. The contract requires 15 completed cases per
skill across both harnesses; 14 cases spread over three skills is not that and
is not offered as that. A sample that agrees with the existing 8 is evidence
that finishing the arm would not change the verdict, which is a reason to stop
spending, not a licence to claim.

It is also worth stating plainly what a null here would mean, since it is the
likely outcome: **the skills would be shown to help one model and not another**,
which is a real and publishable finding about their scope, not a failure of
the measurement.

## Results

To be filled in after the runs. If this section is empty, the runs did not
finish and nothing should be read into the selection above.
