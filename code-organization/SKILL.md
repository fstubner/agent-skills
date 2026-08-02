---
name: code-organization
description: >-
  Structure a codebase's files, modules, and dependencies so the layout
  reflects what the system does, not the framework it's built with —
  covering module boundaries, dependency direction, cohesion vs. coupling,
  and naming that survives a reorg. Triggers when starting a new module or
  directory structure, when a codebase's organization is fighting a change
  (the same conceptual edit keeps touching unrelated folders), or when
  explicitly asked how to structure something. Operates one level up from
  `code-smells` (which is about one function or class) and one level down
  from `systems-architecture` (which is about parts, boundaries, and trust
  between whole services) — this is the layer in between: how one service's
  own internals are laid out.
compatibility: Requires Node 18+ to run the deterministic checker script.
---

# Code organization

The test for good organization: when a single feature changes, does the edit
stay inside one place, or does it scatter across folders that were never
related until this change forced them to be? Layout that optimizes for
"where does this technical *kind* of file go" over "where does this
*capability* live" usually fails that test.

No shared artifacts. Almost all of this is judgment about shape and meaning
that no generic script can verify across arbitrary codebases and languages —
with one exception: **circular imports are genuinely binary, and
`scripts/check-organization.js` checks for them.** Run it for JS/TS
projects: `node <this-skill>/scripts/check-organization.js --root <dir>`.
It walks local (relative) imports only — a package import can't participate
in the kind of cycle this checks — and deliberately ignores `import type`,
since a type-only reference is erased at compile time and creates no
runtime cycle; flagging it would be a false positive on an idiomatic TS
pattern (see `fixtures/code-organization-typeonly-clean` for the exact
case it exists not to flag). Everything else below — naming, cohesion,
where a module's boundary should sit — stays judgment, like `code-smells`.

## The core question

**Organize by what it does, not what it is.** A directory named `services/`,
`controllers/`, `models/` (organized by technical layer) forces every feature
to spread across all three; a directory named `billing/`, `notifications/`,
`auth/` (organized by capability) keeps a feature's edit inside one folder.
This is sometimes called "screaming architecture" — opening the top level
should tell you what the system *does*, not what framework it's written in.

Layered organization isn't wrong everywhere: a small, genuinely
framework-driven app (the framework's own conventions ARE the whole
structure, nothing else) can be simpler laid out the framework's way. The
smell that it's wrong for THIS codebase: touching one feature routinely
means editing three or more top-level folders.

## Rules

1. **Dependency direction should point one way.** If module A depends on B,
   B should not depend on A, even indirectly through a third module — a
   cycle means the two are really one module pretending to be two. Point
   dependencies from concrete/detail toward abstract/policy (an HTTP handler
   depends on a domain function, not the other way around), not the reverse.
   `check-organization.js` catches the literal-import-cycle case of this
   automatically; the direction-of-dependency judgment (which side *should*
   depend on which) is still yours to make.

   When it reports one, there are exactly three fixes, and "add a lazy
   `require` inside the function" is not among them — that hides the cycle
   from the checker while keeping it in the design:
   - **Merge** the modules, if the cycle exists because they are genuinely
     one concept (the usual case for a 2-cycle).
   - **Extract** the shared piece both need into a third module that
     neither imports back — the usual case when both modules are large and
     only their overlap is entangled.
   - **Invert** one direction: the lower-level module takes a callback or
     an injected interface instead of importing the higher-level one.
2. **Cohesion inside a module, low coupling between them.** Things that
   change together belong together; things that change independently
   should be free to, without one edit forcing the other to be touched.
   "Always change in lockstep" is measurable, and `code-smells`'
   `check-cochange.js` measures it — it reads `git log` and reports files
   that appear together in most of the commits touching either. Run it
   before proposing a structure; if it names a set of files spread across
   directories, that set is the module the current layout is missing, and
   your proposal should create it rather than guessing at seams.
3. **Name for the domain, not the implementation.** A folder named `utils/`,
   `helpers/`, `common/`, `shared/`, `misc/` or `lib/` describes nothing —
   it's where things go when no one decided what they actually are. Those
   names are the observable form of the rule; grep for them. Renaming the
   folder is not the fix, though: the contents belong wherever their actual
   responsibility lives, which is usually more than one place.
4. **A new module earns its own file/folder by changing independently of
   its neighbors — not by line count.** The evidence is the same co-change
   data as rule 2: a file that repeatedly changes without its neighbors has
   a seam; one that never changes alone does not, however long it is.
   Splitting on length without that evidence is `code-smells`'
   speculative-generality mistake wearing a different hat.
5. **Public surface should be smaller than total surface.** Nothing that is
   never imported from outside its own module appears in that module's
   public entry point — checkable with an unused-exports pass (`ts-prune`,
   `knip`, or a grep for each exported name across the rest of the tree).
   A module that exposes every internal helper gives callers no signal
   about what's meant to be depended on, and every one of those exports is
   a thing you can no longer change freely.
6. **This overlaps with `systems-architecture` and `code-smells` on
   purpose, at different scales.** `systems-architecture` decides where the
   trust boundary between services sits; this skill decides how one side of
   that boundary organizes its own internals; `code-smells` is what a
   single function or class inside that organization looks like up close.
   A misplaced module is this skill's problem; a bloated function inside a
   well-placed module is `code-smells`'.
