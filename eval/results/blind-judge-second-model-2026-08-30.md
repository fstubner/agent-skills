# A second judge: two judges on the same twelve pairs agree five times

The same twelve blind skill-vs-policy pairs, all length-controlled, judged
twice — once by claude-haiku-4-5 and once by claude-sonnet-5.

| pass | skill | policy | tie |
|---|---|---|---|
| haiku, unmodified | 10 | 2 | 0 |
| haiku, length-controlled | 7 | 5 | 0 |
| sonnet, length-controlled | 7 | 3 | 2 |

Both length-controlled judges land on seven skill wins, and neither is
distinguishable from chance: P(≥7 of 10 decisive) = 0.172 for sonnet.

## The number that matters is the agreement, not the tally

**The two judges agreed on 5 of the 12 pairs — 42%.**

On the same reports, with length already controlled, swapping the judge model
changes more than half the verdicts. Four pairs flipped outright between skill
and policy; two more became ties.

    case                                haiku-eq   sonnet-eq
    engineering-assessment-cited-risks  skill      skill
    engineering-assessment-cited-risks  skill      tie
    engineering-assessment-hidden-risks skill      skill
    engineering-assessment-retry-storm  skill      policy
    engineering-assessment-retry-storm  policy     policy
    engineering-assessment-silent-drop  skill      skill
    engineering-assessment-silent-drop  policy     tie
    job-ledger-ordering-assessment      policy     skill
    job-ledger-ordering-assessment      policy     skill
    stale-pass-review                   policy     skill
    stale-pass-review                   skill      skill
    zero-count-export-acceptance        skill      policy

A single judge's verdict on a single pair carries almost no information about
which report is better. That holds whichever way the verdict points, so it is
not a reason to discount the sceptical results and keep the flattering ones.

## Where this leaves the judge

Three passes, three answers, and the only stable finding across them is that
the unmodified judge tracked length perfectly (12 of 12). Once length is
removed, what remains is noise at this sample size.

The deterministic assertions say engineering-assessment has no demonstrated
win — outcome delta 0.2725, 95% CI lower bound 0.0355 against a 0.1 bar.
Nothing in three judge passes contradicts that, and the one pass that appeared
to was measuring bytes.

## What would make the judge worth running

- **More pairs.** Twelve cannot separate a small effect from noise. The
  agreement figure suggests many more would be needed.
- **A panel, not a judge.** Requiring two independent models to agree before
  counting a verdict would discard the 7 disagreements here rather than
  averaging them into a number.
- **A judge outside the family.** Both models are Anthropic; codex would be a
  genuinely independent reader. It needs no write access to judge, so the
  read-only sandbox that blocks codex eval runs is not an obstacle.

Until then the judge is an exploratory instrument. All judgements remain
`evidentiary: false` and none feed promotion.

## One fix this exposed

The judgement filename had no judge model in it, so running a second judge
over the same pair silently overwrote the first one's verdict — which would
have destroyed exactly the comparison this pass exists to make. The model is
now part of the filename.
