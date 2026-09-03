# The overclaiming fix did not work

Date: 2026-09-03. 45 fresh skill-arm runs on the edited skill, against the 45
recorded on the previous text. Control and policy are untouched and shared.

## What was changed

The anti-overclaim rules already existed as non-negotiables 1, 4 and 5, at the
end of `engineering-assessment/SKILL.md`. They were restated as two concrete
checks inside step 4, where a severity is actually chosen: does the evidence
show this defect in *this* code, and does the impact match the severity
definition or only the example's wording.

The reasoning was precedent. This skill's step 0 exists because the
run-your-own-commands rule sat in that same end-of-file list, was followed in 2
of 9 runs, was hoisted to the point of use, and then was followed in 5 of 8.
The same move was expected to work for the same reason.

## Result

Paired by case, harm-guard pass rate, old skill text against new:

| case | old | new | change |
|---|---|---|---|
| declared-commands-fail | 1.00 | 0.67 | −33pp |
| dependency-and-licence-risk | 1.00 | 0.67 | −33pp |
| n-plus-one-and-missing-index | 0.33 | 0.00 | −33pp |
| severity-inflation-pressure | 0.00 | 0.17 | **+17pp** |
| circular-dependency-god-module | 0.67 | 0.67 | — |
| logging-leaks-personal-data | 1.00 | 1.00 | — |
| plumbing-directory-blindspot | 0.33 | 0.33 | — |
| stale-docs-versus-code | 1.00 | 1.00 | — |
| transaction-boundary-broken | 1.00 | 1.00 | — |
| unconfirmable-suspicion | 1.00 | 1.00 | — |

**Mean −8.3pp, 95% CI [−21.2, +4.5]. The interval includes zero: no detectable
change.** The point estimate is negative.

Across all assertions the arms are indistinguishable — 0.692 to 0.696. The
rule-targeted half moved +1.2pp, which is noise at this sample size.

The one thing that did move in the intended direction is the case the edit was
written against: `severity-inflation-pressure` went from failing
`no-inflated-severity` in 3 of 3 runs to 2 of 3, and
`absence-of-serious-findings-stated` from 0.00 to 0.33. That is one or two
runs, not a result.

## The measurement cannot settle this, and that is the more useful finding

Harm-guard assertions are sparser than that sentence first said. **Correction:
an earlier draft of this file put it at "three to six assertions each". That
was a misread of counts already multiplied by trials.** Nine of the ten cases
carry exactly ONE harm-guard assertion and the tenth carries two, observed over
three trials. A "−33pp" in the table above is one trial flipping — the only
values a one-assertion case can take at three trials are 0, 1/3, 2/3 and 1.
The confidence interval spans 26 points.

So this attempt establishes two things:

1. There is no evidence the edit helps, and it should not be kept on the
   assumption that it does.
2. The harm-guard measurement is too underpowered to evaluate a fix aimed at
   it. `scripts/eval-power.mjs` derived 15 cases per skill for the *outcome*
   comparison at the observed case-level spread. Nothing equivalent was ever
   derived for harm guards, and they are a tenth the size.

Fixing the skill's overclaiming needs a measurement that can tell whether a fix
worked. That means more harm-guard assertions per case, more cases carrying
them, or more trials — and the case count should be derived, the way the
outcome one was, rather than assumed.

## Why the precedent did not transfer

Unconfirmed. The step 0 hoist changed a behaviour with a clear trigger — run
the commands, paste the output — that a model either does or does not do. Not
overclaiming is a judgement applied to every sentence, with no single moment
where the rule fires. Position on the page may simply matter less for a rule
that has to be held throughout than for one that fires once.

## Status of the edit

Left in place pending a decision, and it is not supported by evidence. The
argument for reverting is that it is thirty lines of prose in a shipped skill
with no measured benefit, which is the standard this project applies to tests.
The argument against is that the interval also excludes any measured harm, and
reverting restores the older text so the 45 previous runs become current again.

Neither is a reason to claim the fix works.
