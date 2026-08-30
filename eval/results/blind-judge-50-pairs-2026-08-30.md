# Fifty pairs: the panel is a dead heat

The twelve-pair panel leaned skill 8-3 and I called it "unresolved, leaning
skill". Four times the pairs settles it: **22-22**.

## The result

Fifty index-matched pairs, every one length-controlled and judged by all three
models.

| judge | skill | policy | tie |
|---|---|---|---|
| haiku | 21 | **29** | 0 |
| sonnet | 23 | 20 | 7 |
| codex | **30** | 20 | 0 |
| **panel majority** | **22** | **22** | 6 with no majority |

P(22 of 44 decisive by chance) = **0.56**. Twenty of fifty were unanimous.

The two Anthropic-vs-vendor extremes point in opposite directions — haiku
prefers the policy arm 29-21, codex prefers the skill arm 30-20 — and neither
reaches significance alone (P = 0.161 and 0.101). Averaged over a panel they
cancel exactly.

## What this corrects

At twelve pairs the panel read 8-3 for the skill, P = 0.113, and I described it
as leaning skill and worth more data. It was noise. The lean did not survive
contact with 38 more pairs, and it reversed rather than weakened: the same
panel now splits down the middle.

That is the second time in this line of work that a twelve-pair result pointed
somewhere the larger sample did not go. The first was the uncontrolled judge's
10-2, which turned out to be byte count. Twelve pairs is not enough to say
anything here, and I should stop treating a twelve-pair tally as a signal that
merely needs confirming.

## Judge reliability, now measured properly

Pairwise agreement across fifty pairs:

    haiku vs sonnet   27/50  (54%)
    haiku vs codex    29/50  (58%)
    sonnet vs codex   28/50  (56%)

All three sit near 55%. On a two-way choice with occasional ties, that is
barely above what independent coin flips would produce. The earlier 9/12
agreement between sonnet and codex — which is what made haiku look like the
outlier — was itself small-sample noise; at n=50 no pair of judges agrees
meaningfully more than any other.

So the panel does not aggregate three informative opinions. It aggregates three
weak ones, and the aggregate is a coin flip.

## Where the judge line ends

- **Length inflation: established.** The uncontrolled judge tracked byte count
  12 of 12. That finding stands and is the only robust one produced here.
- **Holistic quality after length control: no difference.** 22-22, P = 0.56, at
  fifty pairs.
- **Judge reliability: poor and now quantified.** ~55% pairwise agreement.

The deterministic assertions and the holistic comparison now agree.
engineering-assessment is at outcome delta 0.2725 with a 95% CI lower bound of
0.0355 against a 0.1 bar, at 47.7% more cost, and fifty blind length-controlled
comparisons find no quality difference to offset that cost.

Further pairs are not the obvious next move. At ~55% inter-judge agreement the
instrument's own noise dominates, so more of it buys precision on a number
whose meaning is unclear. Making the judge more reliable — a sharper rubric,
forced citation of specific passages, or dropping the holistic verdict for
targeted questions a judge can answer consistently — would come first.

All judgements remain `evidentiary: false` and none feed promotion.
