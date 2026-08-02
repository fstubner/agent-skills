# ai-prose-slop, judgment-only patterns — 2026-08-02

The last of the four underpowered nulls, re-run against what the skill
actually claims that tooling cannot do.

## Why the earlier runs measured nothing

Both previous attempts used prose the Vale rules already catch. Both arms
cleaned it, 10 hits to 0, and the run discriminated nothing — of course it
didn't: the deterministic layer does that work, and neither arm needed the
skill for it.

`references/patterns.md` splits its catalogue in two, and the judgment-only
half is the part with no regex behind it. That half had never been tested.

## The fixture

A build-performance blog post, 244 words, engineered to score **SHIP with
zero hits** on `check-prose.js` — verified before either arm ran, and the
run would have been void otherwise — while carrying one instance of each
judgment-only pattern:

| Planted | Surface form |
|---|---|
| binary-contrast framing | "This isn't a story about caching. It's a story about what we measured." |
| faux-insight setup | "What nobody tells you about build performance is…" |
| colon-reveal drama | "The real problem: our test runner rebuilt every package." |
| fake-strong verbs | "serves as the entry point", "acts as a bridge between" |
| negative listing | "Not a caching layer. Not a new tool. A hash check." |
| rhetorical self-answered question | "So what changed?" |
| synonym cycling | the same component called runner, job, task, process |

## Result — the clearest discrimination of any batch

| | Control | Forced |
|---|---|---|
| Patterns removed | **1 / 7** | **4 / 7** |
| Facts preserved | 6 / 6 | 6 / 6 |
| Length | 244 → 238 | 244 → 216 |

Control removed only the faux-insight opener — the one that reads most
obviously as filler — and left binary-contrast, colon-reveal, both
fake-strong verbs, negative listing, the rhetorical question and the
synonym cycling all intact. It produced a competent, unremarkable edit.

Forced additionally removed binary-contrast, colon-reveal and both
fake-strong verb constructions, rewriting "serves as the entry point" and
"acts as a bridge between" into plain statements.

**This is the first evidence that ai-prose-slop's prose guidance does
something the model does not do unprompted.** Everything measured before
was the Vale layer's work.

## What the forced arm still missed, and why it matters

Three survived, verified by reading the output rather than trusting the
scorer:

- `So what changed?` — rhetorical self-answered question, untouched.
- `Not a caching layer. Not a new tool. A hash check.` — negative listing,
  untouched.
- runner / job / task / process — synonym cycling, untouched. This is the
  hardest of the three: it is invisible in any single sentence and only
  appears when you hold four paragraphs at once, which is exactly the
  property that keeps it out of a regex.

So the honest score is **4/7, not a clean win**. The skill moves the needle
on the patterns with a recognisable local shape and does not yet reach the
ones that are distributed across a passage. `SKILL.md` rule 5 now requires
walking the judgment-only list and reporting each category as hits or
`none found`; this arm did not do that, which is the most likely fix and
is itself now testable.

## Standing

n=1 per arm. The fixture is reusable and the precondition (zero
deterministic hits) is mechanically checkable, so this is repeatable at
higher n without rebuilding anything.

All four underpowered nulls are now retested:
`code-smells` positive, `mental-models` positive on process,
`ai-prose-slop` positive on 4 of 7, `testing-strategy` a genuine null.
