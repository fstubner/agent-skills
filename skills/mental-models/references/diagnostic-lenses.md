# Diagnostic lenses

For tracing a fault backward to its cause. If nothing is actually broken —
you're building toward a goal instead — these are the wrong family; see
`generative-lenses.md`.

## Linear root-cause (Five Whys)

**For:** one thing broke, there's a single findable causal chain.

**How:** ask "why" repeatedly, following one thread, until you reach
something you can actually act on — a decision, a missing check, a
resource limit. Stop there; don't keep asking why past the point of
actionability.

**Failure mode — the one this lens is usually misapplied into:** Five Whys
assumes a single linear chain. Resilience-engineering critiques of the
method (Card, Peerally, and Cook) point out that in genuinely interconnected
systems there is no single root cause — a break can have several
contributing factors, weighted differently, and Five Whys will happily walk
you down *one* of them while the others go unexamined. If asking "why"
starts branching into more than one plausible direction, that branching is
the signal you're in **systems / interconnected mapping** territory, not a
sign to just pick the branch that feels right and keep going.

**Worked shape:** "The deploy failed" → why → "the migration errored" → why
→ "the column already existed" → why → "a previous failed deploy partially
applied it and nobody rolled it back." Stop there — that's actionable
(fix the rollback process), not "why did nobody roll it back," which
trails off into org-culture speculation the chain can't actually support.

## Systems / interconnected mapping

**For:** several plausible causes that interact, or a break with no single
clean chain — the "why" branches instead of running in a line.

**How:**
1. List every factor that might contribute — from what actually exists,
   not what would be convenient to blame.
2. Weight each by real evidence, not plausibility. Juran's observation on
   quality causes (borrowing from Pareto) holds here too: a small number of
   factors usually carry most of the effect — what he called the vital few,
   later softened to "the vital few and the useful many" so as not to write
   off the rest entirely.
3. Cut factors that don't survive a check (see the coverage test in
   `meta-lenses.md` — this lens and that check are meant to be used
   together, not sequentially-then-forgotten).

**Failure mode:** stopping at the first factor that "fits" the symptom.
A factor whose only evidence is the symptom you started with isn't a cause
you've found — it's the symptom, renamed. This is exactly what the
coverage test exists to catch.

**Worked shape:** ticket volume is up. Candidate factors: a recent release,
seasonal usage, a marketing push, a real regression. Don't stop at
"a release went out recently" — check whether the specific tickets
correlate with the release's affected code paths, whether volume was
already trending up before the release, whether the marketing push's
timing lines up better. Weight by what the data actually shows, not by
which explanation is easiest to act on.
