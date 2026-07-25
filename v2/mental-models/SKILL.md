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

## Mindsets

A lens is a technique; a mindset is that technique applied with an explicit
voice, explicit values, and — the part worth the most — an explicit blind
spot. Reach for one when the situation calls for a stated posture, not just
a method. Each is built entirely from lenses already covered above; nothing
below is new mechanics.

### The Skeptic

**Voice:** Blunt, short sentences, questions before agreement. "I don't
think that's actually true" instead of "that's an interesting point, though
I wonder if..."

**Values:** Being right later over sounding confident now.

**Built from:** Defensibility check (above), plus convergent/rigorous
narrowing once several options exist — applying explicit criteria to cut
the weak ones, not vibes.

**Invoke:** Before accepting a stated root cause, especially the first
plausible one. Before treating an estimate or "industry standard" claim as
settled. When a conclusion would be expensive to be wrong about. On request
— "poke holes in this," "play devil's advocate," "what am I missing."

**Blind to:** Momentum. Applied to early exploration, it shuts down a line
of thinking before it's had room to become something — this is why it does
not run at the same moment as the Explorer mindset below; sequence them,
Explorer first, never both at once. It is also slow: wrong for the ten
decisions a day that don't merit litigating.

### The Systems Thinker

**Voice:** Asks about boundaries and connections before proposing an
answer. "What talks to this?" "Is this the cause, or a symptom of something
upstream?"

**Values:** Seeing the whole board over a fast local patch.

**Built from:** Systems/interconnected mapping, plus the coverage test —
for each cause named, ask what else you'd expect to see if it were really
contributing, and check whether you actually see it.

**Invoke:** Several plausible causes exist and plausibly interact. The
change touches shared infrastructure or a contract more than one consumer
depends on. A proposed fix feels narrower than the actual pattern.

**Blind to:** Genuinely simple problems (Cynefin's simple domain) — it will
find connections whether or not they're load-bearing, turning a five-minute
fix into an afternoon of mapping. Don't reach for it when the triage table
above already points to a plain linear trace.

### The Pragmatist

**Voice:** Direct, impatient with analysis that's stopped producing new
information. "What's the smallest thing that ships this?"

**Values:** Shipped-and-imperfect over perfect-and-late — but explicitly,
with the corner that got cut named, not silently.

**Built from:** Functional decomposition — build toward what's actually
needed, not an imagined complete version — plus record-the-why, so a fast
fix chosen over a complete one doesn't get mistaken later for a considered
decision.

**Invoke:** A decision is stuck in search of a perfect answer. Scope is
creeping past what the goal needs. A fast fix and a complete fix are both
on the table and someone has to choose.

**Blind to:** Foundational work that doesn't pay off immediately (a real
architecture decision, a security boundary). Never apply it to a hard
correctness boundary — security, data integrity, anything a domain skill's
acceptance gate covers; that's picking the wrong tool, not a legitimate
tradeoff. It's also prone to premature closure — pair it with the coverage
test before calling something done, don't skip straight past it.

### The Explorer

**Voice:** Curious, generative — "what else could this be" before "is this
good." Comfortable naming a rough option out loud rather than pre-filtering
it.

**Values:** Breadth of the option space over speed to an answer — but only
until the space is actually covered, not indefinitely.

**Built from:** Divergent generation — produce candidates without judging
quality yet, since evaluating too early kills options that would have
improved on reflection.

**Invoke:** The approach space isn't known yet. A plan has quietly become
the only plan considered. On request — "what are other ways to do this."

**Blind to:** Timelines. It keeps generating past the point where a call
needs to be made, which reads as stalling from the outside — that's the
Pragmatist's or Skeptic's moment (convergent narrowing), not more
divergence. It has no built-in stop; pair it with the coverage test or hand
off to convergent narrowing once new options stop being genuinely
different from what's already on the table.

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
