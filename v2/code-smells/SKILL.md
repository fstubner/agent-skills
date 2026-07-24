---
name: code-smells
description: >-
  Spot and fix structural code smells — duplicated code, long functions,
  god objects, feature envy, primitive obsession, shotgun surgery, and
  Fowler's other named symptoms of a design under strain — without
  rewriting working code that just happens to look unusual. Triggers when
  reviewing existing code for maintainability, when a change touches the
  same handful of files every time (a smell in itself), or when explicitly
  asked to clean up or refactor. Not for new code being written for the
  first time (a smell is a pattern that emerged under real use; guessing at
  one in advance is premature abstraction) and not a substitute for a
  linter's mechanical rules (unused vars, formatting) — this is the layer
  above that, for symptoms only a reader can recognize.
---

# Code smells

A smell is not a bug. Code with a smell usually works; the smell is a signal
that the next change will be harder than it should be. Treat a hit as a
prompt to look at that code's shape, not an automatic rewrite — some
"smells" are the right call for the constraints they were written under.

No shared artifacts, no checker script. Unlike the prose patterns in
`ai-prose-slop`, most of these resist generic detection: recognizing "this
class does too much" requires understanding what the methods actually do,
not just counting them. A crude structural check (function line count, file
size) would flag plenty of legitimate code and miss most real instances —
better to say so than ship a check that's mostly noise. This is a judgment
skill, like `mental-models`; lean on the reader, not a script.

## Catalog

Full detail, examples, and the fix for each are in
`references/catalog.md` — the summary below is enough to recognize one, not
enough to fix it well.

| Smell | The tell |
|---|---|
| Duplicated code | The same logic, copied instead of shared, now drifting |
| Long function | Doing several unrelated things in sequence |
| Large class / god object | Owns too many unrelated responsibilities |
| Long parameter list | Callers constantly reordering or misreading args |
| Feature envy | A method more interested in another object's data than its own |
| Primitive obsession | A concept (money, an ID, a range) passed around as a raw primitive |
| Data clumps | The same 3-4 fields, always together, never named as a thing |
| Shotgun surgery | One conceptual change requires edits across many files |
| Divergent change | One file changes for many unrelated reasons |
| Switch/type-check chains | Repeated branching on a type that a fixed poly­morphic dispatch would replace |
| Speculative generality | Abstraction built for a future need that hasn't arrived |
| Dead code | Reachable code nothing calls, or a flag that's always the same value now |
| Comment as deodorant | A comment explaining code that's confusing instead of code that's clear |

## Rules

1. **A smell is a prompt to look, not a verdict.** Some of these are the
   correct tradeoff under real constraints (a data clump kept flat because a
   struct would need to cross a serialization boundary that doesn't support
   it). Check before cutting.
2. **Don't refactor code you weren't asked to touch.** Flag a smell noticed
   in passing; don't rewrite it as a side effect of an unrelated change —
   that's how a small fix turns into an unreviewable diff.
3. **Fix the smell, not the symptom's symptom.** Renaming a god object's
   methods to sound tidier isn't a fix; splitting its responsibilities is.
   If a full fix is out of scope right now, say what the real fix would be
   and why it's deferred, rather than a cosmetic pass that reads as done.
4. **New code doesn't get pre-emptively "de-smelled."** Primitive obsession
   and speculative generality are opposite failure modes of the same
   instinct — guessing at the abstraction a smell would eventually demand,
   before real use revealed whether it was needed. Write the plain version
   first; let a real second use justify the abstraction (see
   `mental-models`' functional decomposition, which builds toward what's
   needed, not what might be needed).
5. **This overlaps with `code-organization` on purpose, at a different
   scale.** A smell is local — one function, one class, one file. If the
   pattern repeats across the whole codebase (every module doing its own
   version of the same thing), that's a `code-organization` question, not a
   single smell to fix in place.
