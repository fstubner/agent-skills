# The blind judge measures length

Twelve blind skill-vs-policy comparisons, claude-haiku-4-5 judging deliverables
with conditions and filenames stripped. The skill arm won 10 of 12.

That number should not be used. It carries no information beyond which document
was longer.

## The confound

| | skill won | policy won |
|---|---|---|
| longer deliverable won | 10 | 0 |
| shorter deliverable won | 0 | 2 |

**Every one of the twelve judgements went to the longer document.** The two the
skill arm lost are exactly the two where its deliverable was shorter. Verdict
and byte count agree 12 times out of 12, so nothing in this pass distinguishes
"better" from "longer".

Sizes, bytes of markdown in each run's outputs:

    engineering-assessment-cited-risks    skill 7294  policy 5272   skill won
    engineering-assessment-cited-risks    skill 7406  policy 6343   skill won
    engineering-assessment-hidden-risks   skill 5642  policy 4873   skill won
    engineering-assessment-retry-storm    skill 5605  policy 4655   skill won
    engineering-assessment-retry-storm    skill 6259  policy 3642   skill won
    engineering-assessment-silent-drop    skill 8393  policy 3803   skill won
    engineering-assessment-silent-drop    skill 6702  policy 3581   POLICY won
    job-ledger-ordering-assessment        skill 7261  policy 5406   skill won
    job-ledger-ordering-assessment        skill 6825  policy 4671   skill won
    stale-pass-review                     skill 4096  policy 3567   POLICY won
    stale-pass-review                     skill 1939  policy 1385   skill won
    zero-count-export-acceptance          skill 1989  policy 1038   skill won

## Why this was worth checking

The deterministic assertions put engineering-assessment's outcome delta at
0.2725 with a 95% CI lower bound of 0.0355 against a 0.1 bar -- no demonstrated
win. A blind judge saying "skill wins 10 of 12" reads like the deterministic
assertions are missing something a person would see, and that is a tempting
story: the skill produces better prose, the regexes cannot tell.

The length check refutes it. The skill arm also costs 47.7% more (CI 14.9% to
80.5%) on this skill, which is the same fact from the other side: it writes
more. A judge that prefers more is measuring the cost, not the quality.

## What the pass is still good for

Nothing here says the judgements are wrong, only that they are not independent
of length. Separating the two needs a design this pass does not have:

- pairs matched on length, or deliverables truncated to equal length
- a judge prompt that names padding as a defect rather than leaving it neutral
- a judge from a different model family; haiku judged its own outputs in six of
  these twelve

Until one of those exists, the honest summary of the blind judge is that it has
not yet told us anything the byte count did not.

## Scope

Eighteen pairs attempted, twelve judged. Six failed with "no deliverable
found": retry-delay-regression-suite and shipping-fee-regression-suite produce
test suites rather than prose, and one acceptance run wrote no report. That is
a real limit of a prose comparator, not a fault to fix.

Judgements are stored under `eval/judgements/`, already labelled
`evidentiary: false`, and never feed promotion.
