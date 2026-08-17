# Generative lenses

For building toward a goal — nothing is broken, there's just an ambiguous
"make X happen" with no obvious first step. If something IS broken, these
are the wrong family; see `diagnostic-lenses.md`.

## Functional decomposition (means-ends analysis)

**For:** an ambiguous goal that needs to be turned into addressable parts
before any of them can be worked on.

**How:** break the goal into named, specific sub-outcomes — not vague
gestures at the goal, but qualities you could point at and say "that one,
specifically." Newell and Simon's General Problem Solver (late 1950s)
framed this as comparing where you are to where you want to be, naming the
specific differences, and finding an operator — a known method — that
closes each one.

**The non-obvious part, worth getting right:** checking a decomposed
dimension against the actual case is often *itself* the diagnosis, not a
separate step that comes after decomposing. Take an unconvincing painting:
decompose "make it work" into texture, lighting, and color harmony, then
check each against the actual canvas — "is the lighting wrong" against a
real canvas usually just *is* the answer, not a sorting step before the
real diagnosis starts. Decomposition and diagnosis collapse into the same
move once you have real, named dimensions to check.

**Failure mode:** collapsing two distinct layers into one. The decomposed
sub-outcomes are the *target qualities* (texture, lighting, harmony) — they
are not the tools. The tools are the specific techniques that produce each
quality (impasto for texture, a value study for lighting, a limited palette
for harmony). Naming a quality and naming the method that produces it are
different acts; conflating them makes the whole decomposition read as
"tools achieving tools," which is incoherent.

## Divergent generation

**For:** the space of possible approaches isn't known yet — before you've
committed to solving something one particular way.

**How:** generate multiple candidate approaches without filtering any out
yet. Resist judging quality during generation — evaluating too early kills
options that would have improved on reflection, and collapses the search
before it's had a chance to cover the space. This is the generative half of
Guilford's divergent/convergent distinction (1950s creativity research),
still the standard framing in brainstorming and design-thinking practice.

**Failure mode:** skipping straight to the first workable idea. A fast,
plausible-sounding first answer is not the same as a considered one — the
same habit `ai-prose-slop` catches in prose (a fabricated-but-plausible
example standing in for a real one) shows up here as a single
first-guess approach standing in for an actual survey of the option space.

## Convergent / rigorous narrowing

**For:** after divergent generation, or whenever there are too many
plausible options and an actual decision is needed.

**How:** apply explicit criteria — not vibes — to eliminate options. State
*why* each cut option was cut, not just that it was. If you can't state a
reason, you haven't actually converged, you've just picked one.

**Failure mode:** converging before genuinely divergent generation
happened. This just re-labels "the first idea" as "the chosen idea"
without ever actually comparing it to anything — a decision that looks
rigorous but isn't, because nothing was weighed against it.
