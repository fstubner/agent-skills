---
name: code-smells
description: >-
  Spot and fix structural code smells — duplicated code, long functions,
  god objects, feature envy, primitive obsession, shotgun surgery, and
  Fowler's other named symptoms of a design under strain — without
  rewriting working code that just happens to look unusual. Triggers when
  reviewing existing code for maintainability, when a change touches the
  same handful of files every time (a smell in itself), or when explicitly
  asked to clean up or refactor. Scoped to the code in front of you — for a
  standing-back audit of a whole codebase, that is engineering-assessment.
  Not for new code being written for the
  first time (a smell is a pattern that emerged under real use; guessing at
  one in advance is premature abstraction) and not a substitute for a
  linter's mechanical rules (unused vars, formatting) — this is the layer
  above that, for symptoms only a reader can recognize.
compatibility: Requires Node 18+ to run the deterministic checker script.
---

# Code smells

A smell is not a bug. Code with a smell usually works; the smell is a signal
that the next change will be harder than it should be. Treat a hit as a
prompt to look at that code's shape, not an automatic rewrite — some
"smells" are the right call for the constraints they were written under.

No shared artifacts. Most of this catalog resists generic detection —
recognizing "this class does too much" requires understanding what the
methods actually do, not just counting them — so it stays a judgment skill,
like `mental-models`. Two exceptions are genuinely checkable without a
per-language parser, and `scripts/check-smells.js` checks them: **file
size** (any language — a long file is a long file regardless of syntax)
and **nesting depth** (brace-delimited languages only: JS/TS and the
C-family, not Python/Ruby's indentation-based nesting or Go's braces,
whose raw-string escaping this checker's string-stripping doesn't handle
safely — see the script's own header for the exact reasoning). Run it:
`node <this-skill>/scripts/check-smells.js --root <dir>`.

**Shotgun surgery is the third checkable one, and it is the reason this
skill has a second script.** It is the one smell in the catalog that
cannot be seen in a file at all — it lives in the change history, in the
fact that adding one field keeps forcing edits across four layers. Reading
a snapshot can never surface it, which is why the trigger in this skill's
own description names it and why a review that only opens the files in
front of it will always miss it:

```bash
node <this-skill>/scripts/check-cochange.js --root <dir> [--commits 200]
```

It reads `git log`, and for each file asks which others are almost always
in the same commit. Three or more such partners spread across three or
more top-level directories is the signal: a concept with no home. Files
inside ONE directory moving together is cohesion, not a smell, and is not
reported. Too little history reports `not_evaluated` rather than a
confident pass — under twenty source commits, a pattern is not
distinguishable from coincidence. It is a review-time check, not a
pre-commit one: it describes the history, not the commit you are making.

Everything else in the table below — duplication, feature envy, primitive
obsession, and the rest — needs a human reader; a codebase in any language
gets the same judgment-only treatment for those.

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
   it). Each smell you report ends one of two ways: the catalog's `Fix:`
   applied, or one line saying which constraint makes it correct here. A
   smell listed with neither is the finding nobody acts on — and "I checked
   before cutting" leaves no trace, so the line is the check.
2. **Don't refactor code you weren't asked to touch.** Flag a smell noticed
   in passing; don't rewrite it as a side effect of an unrelated change —
   that's how a small fix turns into an unreviewable diff.
3. **Fix the smell, not the symptom's symptom.** Apply the `Fix:` bullet
   the catalog names for that smell — renaming a god object's methods to
   sound tidier is not the entry for God Object, splitting responsibilities
   is. If the real fix is out of scope, name it and say why it's deferred.
   A change that touches the smelly code without matching its catalog fix
   is a cosmetic pass that reads as done, and reads that way to the next
   person too.
4. **New code doesn't get pre-emptively "de-smelled."** Primitive obsession
   and speculative generality are opposite failure modes of the same
   instinct — guessing at the abstraction a smell would eventually demand,
   before real use revealed whether it was needed. The countable form: a
   new interface, base class, generic parameter, or config flag needs two
   real call sites at merge time. With one, inline it and wait — the second
   call site is the evidence that the abstraction matches reality rather
   than your prediction of it. (See `mental-models`' functional
   decomposition, which builds toward what's needed, not what might be.)
5. **This overlaps with `code-organization` on purpose, at a different
   scale.** A smell is local — one function, one class, one file. If the
   pattern repeats across the whole codebase (every module doing its own
   version of the same thing), that's a `code-organization` question, not a
   single smell to fix in place.
