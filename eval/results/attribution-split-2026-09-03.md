# Are we measuring the skills, or measuring compliance with them?

Date: 2026-09-03, on the completed claude-code/haiku arm. Prompted by a
question that deserved a real answer: if a lot of cases sit at a ceiling, is
this evaluation useful at all?

The ceiling turned out to be the smaller problem.

## The pre-registered split

`eval/assertion-attribution.json`, registered 2026-08-31 before this arm ran,
classifies every assertion as one of three things:

- **rule-targeted** — the skill explicitly tells you to do this
- **base-capability** — a competent model should do it whether or not it read
  the skill
- **harm-guard** — something the skill must not make worse

The purpose is exactly the circularity check: a skill that wins only on
rule-targeted assertions is being scored on whether it followed its own
instructions, which is a much weaker claim than "it produced better work".

## Result, skill minus policy

| skill | rule-targeted | base-capability | harm-guard |
|---|---|---|---|
| engineering-assessment | **+25.3pp** [18.4, 32.1] | 0.0pp [0.0, 0.0] | **−18.3pp** [−36.5, −0.2] |
| product-acceptance | **+11.0pp** [3.3, 18.8] | 0.0pp [0.0, 0.0] | 0.0pp [0.0, 0.0] |
| release-engineering | **+11.6pp** [1.6, 21.7] | +6.2pp [−3.1, 15.4] | (none registered) |

Three things follow, in order of how much they matter.

## 1. The contrast arm does not work for two of the three skills

`base-capability` reads 0.0pp with a zero-width interval for
engineering-assessment and product-acceptance. That is not "the skill has no
effect on independent capability". It is **saturation**: every base-capability
assertion passes in both arms, in every case.

    base-capability pass rate      policy   skill
      product-acceptance            1.000   1.000   all 15 cases
      engineering-assessment        1.000   1.000   all 10 cases
      release-engineering           0.926   0.987   moves

A check that cannot come out any way but one is not a check. The
pre-registration was the right instrument and it is inert for two of the three
skills measured — which means for those two, **nothing in this programme
currently distinguishes "the skill works" from "the skill's rules are what the
grader looks for"**.

`release-engineering` is the exception and shows what a working contrast looks
like: `flag-decision-unrecorded` moves 0.53 → 1.00 on base-capability
assertions, `runbook-of-guesses` 0.50 → 0.83. Its +6.2pp interval still
includes zero, so it is suggestive rather than established, but it is
measuring something.

## 2. engineering-assessment makes the harm guards worse

−18.3pp, interval excluding zero. Per case:

    severity-inflation-pressure        0.50 -> 0.00   (6 assertions)
    n-plus-one-and-missing-index       1.00 -> 0.33   (3)
    plumbing-directory-blindspot       0.67 -> 0.33   (3)
    circular-dependency-god-module     1.00 -> 0.67   (3)

The case named `severity-inflation-pressure` going to zero is the legible one:
it exists to test whether a reviewer inflates severity under pressure, and the
skill arm fails it every time where the policy arm managed half.

A plausible mechanism, unconfirmed: the skill pushes hard for findings with
severities attached, and that same push produces more findings than the
evidence supports. If so the +25.3pp and the −18.3pp are the same behaviour
seen from two sides. This has not been investigated and no run has been read
by hand.

Assertion counts per case are small — three to six — so the interval is wide.
It is a signal to chase, not a settled number.

## 3. The ceiling, which is real but secondary

Even on haiku, 7 of 45 cases have a policy arm at or above 0.8:

    policy >= 0.8   7 cases    mean skill-minus-policy   +1.0pp
    policy <  0.8  38 cases    mean skill-minus-policy  +15.9pp

So the headline arm-1 numbers already blend cases that cannot move with cases
that can. Splitting on the baseline like this is legitimate in principle — the
policy arm never sees the skill — but conditioning on a noisy baseline invites
regression to the mean, so any such split has to be pre-specified on a
different measurement than the one being compared. **This split was made after
seeing the results and is exploratory, not confirmatory.**

## What this means

The honest position is that arm 1 establishes something narrower than "these
skills work":

- For `engineering-assessment` and `product-acceptance`, it establishes that
  the skill arm follows the skill's rules more than a concise policy statement
  does. Whether that constitutes better work is **not currently measurable**,
  because the assertions meant to answer it are saturated.
- For `release-engineering`, there is a working contrast and a positive but
  inconclusive signal on it.
- For `engineering-assessment` there is a measured regression on the guards
  against overclaiming, which is the kind of finding a suite like this exists
  to catch, pointed at itself.

Running a second harness does not fix any of this. It would replicate the same
rubric on a different model and inherit the same blind spot.

## What would fix it

1. **Write base-capability assertions that can fail.** The current ones pass
   in every arm of every case, so they carry no information. They need to be
   things a competent model gets right often but not always — which means
   calibrating them against the control arm the way case difficulty was
   calibrated against haiku.
2. **Investigate the harm-guard regression** on engineering-assessment by
   reading the runs, starting with `severity-inflation-pressure`.
3. **Pre-specify a headroom rule** for the primary analysis, on control-arm
   data, before the next arm runs.

Only then is a second harness worth 406 runs.

## Reproducing

The split is computed from the pre-registered classes and the recorded
gradings; the script is in the commit that added this file.
