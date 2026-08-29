# design-system-drift: the base model is already good at this

Kept as a regression fixture. No matrix will be bought for it, and this
records why, because the reasoning is the useful part.

## The case

Extract a design system from a clinic portal with no token file and three
years of styling drift: 32 distinct hex literals, a cluster of seven
near-identical greys, three near-identical reds, one blue serving four roles,
`14px` used interchangeably with `0.875rem`, nine colours written as
`rgb()`/`hsl()`/`white` in a legacy stylesheet, a half-adopted `vars.css`
declaring `--brand: #2563ea` against `#2563eb` everywhere else, and a calendar
that computes its colours at runtime so they are not literals at all.

Eleven assertions. The grader separates cleanly on constructed inputs:

| Input | Score |
|---|---|
| correct extraction (reference) | 11/11 |
| untouched fixture | 1/11 |
| token file transcribing all 31 literals | 3/11 |

That third one matters: it is grounded at 100% and still fails most
assertions, which is why coverage is reported and never gated.

## The arms do not separate

| Arm | Score | Missed |
|---|---|---|
| control | 10/11 | grey-drift-collapsed (4 of 7 survive) |
| skill | 10/11 | red-drift-collapsed (3 of 3 survive) |

The two arms differ only in which single collapse they missed, and they
disagree about which. That is noise.

## Making it harder made it worse

The first version of this fixture had nine assertions and the control scored
7/9. Two traps were added specifically to separate the arms — the non-hex
colour forms, and the contradictory `--brand` variable.

**The control caught both.** It unified `rgb(107, 114, 128)` with `#6b7280`,
found the one-character `#2563ea` discrepancy in a variable file only one
screen consumes, and collapsed the reds, which no run had managed on the
easier fixture. The control's score went UP, from 7/9 to 10/11.

The task is not hard for the model. Adding difficulty demonstrated that
rather than fixing it.

## What still fails, and what it means

`grey-drift-collapsed` fails in most runs of both arms. Seven values within
an RGB distance of 9.1, all secondary text, and models keep them as seven
named tokens — `body`, `bodyAlt`, `bodyAltSmall`, `bodyEmpty`, `tableHeader`,
`muted`, `subtle`. Colour consolidation is not something they do unprompted.

But it fails in the CONTROL too, so it is a fact about the models rather than
a lever the `frontend` skill pulls. A case whose control scores 10/11 has one
assertion of headroom, which is the ceiling that made `testing-strategy`'s
codex cohort meaningless.

## Why it is kept

The grader discriminates on constructed inputs, so CI holding it in both
directions is worth something: it pins the behaviour, and it would catch a
regression in the extraction quality of whatever model runs it next. That is
a regression fixture, and it is a fair description of what this is.

It is not evidence for or against the `frontend` skill, and eighteen runs
would not make it into evidence.

## Two bundles on disk

One control, one skill, at case revision 3. Honest partial data, not a
cohort. Anything read from n=1 per arm is a guess.
