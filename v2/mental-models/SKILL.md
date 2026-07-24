---
name: mental-models
description: >-
  A catalog of reasoning lenses — root-cause tracing, systems/interconnected
  mapping, goal decomposition, divergent/convergent generation, and checks
  against premature closure and unsupported conclusions — plus a triage
  guide for picking the right one. Triggers when a problem's cause isn't
  obvious, when facing an ambiguous goal with no clear starting
  decomposition, when choosing between several plausible approaches, or
  when explicitly asked to think about something differently or find what's
  being missed. Not for routine tasks with an obvious next step, and not a
  substitute for a domain skill's own specific rules (e.g. frontend's
  interview-before-styling) — this is a general-purpose complement to
  those, never a replacement.
---

# Mental models

A lens is a way of taking a problem apart. Different problems need
different lenses — using the wrong one is a documented failure mode, not a
neutral choice (Five Whys on an interconnected problem doesn't just work
less well, it actively hides the other contributing factors). Triage first;
don't run every lens on every problem.

No shared artifacts, no checker script — like `anti-ai-slop`, this fires on
its own trigger and works standalone. What it verifies is judgment, not
something a script can check; be honest that the "defensibility check"
below is the only verification this skill has, and it's a discipline, not a
test suite.

## Triage

| Situation | Reach for | Then always |
|---|---|---|
| One thing broke; there's one obvious suspect | Linear root-cause (Five Whys) | Defensibility check |
| Several plausible causes that interact; no single clean chain | Systems/interconnected mapping | Coverage test, then defensibility check |
| Building toward a goal; nothing is actually broken | Functional decomposition | Coverage test, then defensibility check |
| The space of approaches isn't known yet | Divergent generation, then convergent narrowing | Defensibility check |
| Choosing a fast fix over a complete one | Whichever lens above found the fix | Record-the-why |

This table compresses Snowden and Boone's Cynefin framework (Harvard
Business Review, 2007): simple problems have one obvious cause, complicated
problems have a discoverable cause via analysis, complex problems only
reveal their shape through probing and weighting, not a single chain — and
generative work (building toward a goal that doesn't exist yet) is a
different kind of problem than any of Cynefin's fault-categories, which is
why it gets its own row rather than being forced into "complicated."

## Lenses

Full detail, sourcing, and failure modes for each are in the reference
files — the table above is enough to pick one, not enough to apply it well.

**Diagnostic** (tracing a fault backward) — see `references/diagnostic-lenses.md`:
- Linear root-cause (Five Whys)
- Systems / interconnected mapping

**Generative** (building forward from a goal) — see `references/generative-lenses.md`:
- Functional decomposition
- Divergent generation
- Convergent / rigorous narrowing

**Meta** (checking the thinking itself, applies regardless of which lens above got you there) — see `references/meta-lenses.md`:
- Defensibility check
- Coverage test / premature-closure check
- Record-the-why

## Rules

1. **Triage before applying.** Picking the wrong lens isn't a safe default
   — it actively hides what the right lens would have surfaced.
2. **Every lens ends at the defensibility check.** A conclusion that can't
   survive "is this true, can I defend it" isn't done, regardless of which
   lens produced it.
3. **A workable answer is not the same as a complete one.** That's the
   whole point of the coverage test — don't stop at the first thing that
   fits.
4. **This overlaps with `anti-ai-slop` on purpose.** The defensibility
   check is the same discipline anti-ai-slop applies to prose (no
   unsupported superlatives, no fabricated examples), applied here to
   reasoning and conclusions generally. Use both; they check different
   surfaces of the same habit.
