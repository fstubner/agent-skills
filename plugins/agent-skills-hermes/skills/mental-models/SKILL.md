---
name: mental-models
description: >-
  Reason through an open problem in your own system that has more than one
  candidate explanation — diagnosing an incident with several possible
  causes, choosing between plausible approaches, or testing a conclusion you
  have already reached. Supplies reasoning lenses (root-cause tracing,
  systems mapping, goal decomposition, divergent/convergent generation,
  guards against premature closure) and four mindsets (Skeptic, Systems
  Thinker, Pragmatist, Explorer), each with a stated blind spot, so the
  reasoning is auditable rather than asserted. Triggers on "diagnose this",
  "why is this happening", "what am I missing", "what are the other ways to
  do this", or any task where stopping at the first plausible answer is the
  risk. Not for explaining what a known error or concept means, or a fault
  with one standard cause — answer those directly. Not a codebase audit
  (engineering-assessment) and not release or pipeline design
  (release-engineering). Not for routine tasks with an obvious next step.
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

## The reasoning record

Everything below is unverifiable without this. "I considered alternatives"
and "I thought about root causes" leave no trace, so neither you nor a
reviewer can tell a lens that was applied from one that was named. Every
application of this skill ends with a short block, in the response or in
the artifact it produced:

```
Lens: <which one>
Chose it because: <one line — what about the problem selected this lens>
Candidates: <2+ possibilities considered>
Distinguishing evidence: <what would tell them apart — and what you found>
Ruled out: <candidate> because <observation, not intuition>
Defensibility: <the load-bearing claim> — <what would have to be true for
  this to be wrong, and whether you checked>
```

The block is the deliverable of the skill. Its absence means the skill was
not applied, whatever the prose around it says. Fields may be short; none
may be empty, and "Distinguishing evidence: n/a" is only honest when you
genuinely cannot obtain any — say why.

Fill it as you go, not afterwards. Written at the end it becomes a
justification of a conclusion already reached, which is the failure the
skill exists to prevent.

## Rules

1. **Triage before applying.** Picking the wrong lens isn't a safe default
   — it actively hides what the right lens would have surfaced. The same
   goes for picking a mindset: the Skeptic and the Explorer pull in opposite
   directions on purpose (converge vs. diverge) and must never run at the
   same moment, only in sequence. Observable: the `Lens` and `Chose it
   because` lines exist and name one lens, not several.
2. **Every lens ends at the defensibility check.** A conclusion that can't
   survive "is this true, can I defend it" isn't done, regardless of which
   lens produced it. Observable: the `Defensibility` line states what would
   have to be true for the conclusion to be WRONG — a restatement of the
   conclusion doesn't satisfy it. For a genuinely high-stakes conclusion,
   self-assessment has a real limit — see "Escalating it for a high-stakes
   conclusion" in `references/meta-lenses.md` for getting an actually
   independent second opinion instead of re-reading your own reasoning and
   nodding.
3. **A workable answer is not the same as a complete one.** That's the
   whole point of the coverage test — don't stop at the first thing that
   fits. Observable: `Candidates` lists at least two, and each one not
   chosen has a `Ruled out ... because` citing something observed. One
   candidate means the coverage test didn't run.
4. **This overlaps with `ai-prose-slop` on purpose.** The defensibility
   check is the same discipline ai-prose-slop applies to prose (no
   unsupported superlatives, no fabricated examples), applied here to
   reasoning and conclusions generally. Use both; they check different
   surfaces of the same habit.
