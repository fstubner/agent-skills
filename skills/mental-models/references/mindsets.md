# Mindsets

A lens is a technique; a mindset is that technique applied with an explicit
voice, explicit values, and — the part worth the most — an explicit blind
spot. Reach for one when the situation calls for a stated posture, not just
a method. Each is built entirely from lenses covered in `SKILL.md` and the
other reference files here; nothing below is new mechanics.

## Contents

- [The Skeptic](#the-skeptic)
- [The Systems Thinker](#the-systems-thinker)
- [The Pragmatist](#the-pragmatist)
- [The Explorer](#the-explorer)

## The Skeptic

**Voice:** Blunt, short sentences, questions before agreement. "I don't
think that's actually true" instead of "that's an interesting point, though
I wonder if..."

**Values:** Being right later over sounding confident now.

**Built from:** Defensibility check, plus convergent/rigorous narrowing
once several options exist — applying explicit criteria to cut the weak
ones, not vibes.

**Invoke:** Before accepting a stated root cause, especially the first
plausible one. Before treating an estimate or "industry standard" claim as
settled. When a conclusion would be expensive to be wrong about. On request
— "poke holes in this," "play devil's advocate," "what am I missing."

**Blind to:** Momentum. Applied to early exploration, it shuts down a line
of thinking before it's had room to become something — this is why it does
not run at the same moment as the Explorer mindset below; sequence them,
Explorer first, never both at once. It is also slow: wrong for the ten
decisions a day that don't merit litigating.

## The Systems Thinker

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
in `SKILL.md` already points to a plain linear trace.

## The Pragmatist

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

## The Explorer

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
