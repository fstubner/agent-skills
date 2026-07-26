---
name: mental-models
description: >-
  A catalog of reasoning lenses — root-cause tracing, systems/interconnected
  mapping, goal decomposition, divergent/convergent generation, and checks
  against premature closure and unsupported conclusions — plus four named
  mindsets (Skeptic, Systems Thinker, Pragmatist, Explorer) that apply a lens
  with an explicit voice and a stated blind spot. Triggers when a problem's
  cause isn't obvious, when facing an ambiguous goal with no clear starting
  decomposition, when choosing between several plausible approaches, when
  asked to "poke holes in this" / "what am I missing" / "what are the other
  ways to do this," or when explicitly asked to think about something
  differently. Not for routine tasks with an obvious next step, and not a
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

No shared artifacts, no checker script — like `ai-prose-slop`, this fires on
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
different kind of problem than any of Cynefin's domains (simple,
complicated, complex, chaotic), which is why it gets its own row rather
than being forced into "complicated."

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

## Mindsets

A lens is a technique; a mindset is that technique applied with an explicit
voice, explicit values, and — the part worth the most — an explicit blind
spot. Each is built entirely from lenses already covered above; full
voice/values/invoke/blind-spot detail for each is in
`references/mindsets.md` — the table below is enough to pick one, not
enough to apply it well.

| Mindset | Invoke when | Blind to |
|---|---|---|
| The Skeptic | Before accepting a stated root cause or "industry standard" claim; a wrong conclusion would be expensive; on request ("poke holes in this") | Momentum — never runs alongside the Explorer, sequence them instead |
| The Systems Thinker | Several plausible causes interact; the change touches shared infrastructure | Genuinely simple problems — turns a five-minute fix into an afternoon of mapping |
| The Pragmatist | A decision is stuck chasing a perfect answer; scope is creeping | Foundational work and hard correctness boundaries (security, data integrity) |
| The Explorer | The approach space isn't known yet; a plan has quietly become the only plan considered | Timelines — has no built-in stop, pair it with the coverage test |

## Rules

1. **Triage before applying.** Picking the wrong lens isn't a safe default
   — it actively hides what the right lens would have surfaced. The same
   goes for picking a mindset: the Skeptic and the Explorer pull in opposite
   directions on purpose (converge vs. diverge) and must never run at the
   same moment, only in sequence.
2. **Every lens ends at the defensibility check.** A conclusion that can't
   survive "is this true, can I defend it" isn't done, regardless of which
   lens produced it. For a genuinely high-stakes conclusion, self-assessment
   has a real limit — see "Escalating it for a high-stakes conclusion" in
   `references/meta-lenses.md` for getting an actually independent second
   opinion instead of re-reading your own reasoning and nodding.
3. **A workable answer is not the same as a complete one.** That's the
   whole point of the coverage test — don't stop at the first thing that
   fits.
4. **This overlaps with `ai-prose-slop` on purpose.** The defensibility
   check is the same discipline ai-prose-slop applies to prose (no
   unsupported superlatives, no fabricated examples), applied here to
   reasoning and conclusions generally. Use both; they check different
   surfaces of the same habit.
