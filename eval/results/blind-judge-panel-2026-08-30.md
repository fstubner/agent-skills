# Three judges, length-controlled: a panel that leans skill without proving it

A codex judge (gpt-5.6-luna) now runs the same twelve length-controlled pairs,
giving three independent readers from two vendors.

| judge | skill | policy | tie |
|---|---|---|---|
| haiku, **no** length control | 10 | 2 | 0 |
| haiku, length-controlled | 7 | 5 | 0 |
| sonnet, length-controlled | 7 | 3 | 2 |
| codex, length-controlled | **10** | 2 | 0 |

## Correcting the previous conclusion

The last writeup said that once length is removed "what remains is noise at
this sample size". That was drawn from one judge — haiku — and it was too
strong. With three judges the picture is mixed, not empty:

- **haiku is the outlier.** It agrees with sonnet on 5 of 12 and with codex on
  5 of 12. Sonnet and codex agree with each other on **9 of 12**.
- Two of the three length-controlled judges lean skill; the third splits.

The earlier finding that survives untouched is the first one: the
*uncontrolled* judge agreed with byte count 12 times out of 12. Length
inflation is real and was doing all the work in that pass. What is now
corrected is the claim that nothing is left underneath it.

## The panel, which is the defensible aggregate

Majority of three per pair:

    skill 8    policy 3    no majority 1
    unanimous  4 of 12

P(8 of 11 decisive by chance) = **0.113**. Not significant at n=12.

## Why not report codex's 10-of-12

Codex alone gives P = 0.0193, which clears 0.05. Reporting that as the result
would mean running three judges and then choosing the one with the strongest
number, which is how a null becomes a finding. The panel is what three judges
were run to produce, and the panel does not reach significance.

The same discipline cuts the other way: haiku's 7-5 is equally not the answer,
and it is the one that supported the tidier sceptical story.

## Where the judge line now stands

- Length inflation: **established.** 12 of 12 in the uncontrolled pass.
- Holistic quality after controlling length: **unresolved, leaning skill.**
  8-3 on a three-judge panel, p = 0.113, with only 4 of 12 unanimous.
- Judge reliability: **poor.** Two Anthropic models agreed on 5 of 12; a
  cross-vendor pair agreed on 9 of 12. Single-judge verdicts stay unusable.

This does not move the deterministic result. engineering-assessment remains at
outcome delta 0.2725, 95% CI lower bound 0.0355 against a 0.1 bar, and costs
47.7% more. A holistic lean that cannot reach significance at twelve pairs is
not a reason to promote a skill that its own assertions do not support — but
it is a reason to stop saying the judge found nothing.

More pairs is the obvious next step, and the panel gives a cheaper stopping
rule than a bigger single-judge run: count only pairs where two of three agree.

All judgements remain `evidentiary: false` and none feed promotion.

## Implementation note

Judging reads two documents and writes nothing, so codex needs only
`--sandbox read-only` — the container that eval-run requires on Windows is not
needed here. `--judge-harness codex` selects it; the verdict is parsed from the
last completed `agent_message` in codex's JSONL stream.
