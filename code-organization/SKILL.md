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
2. **Cohesion inside a module, low coupling between them.** Things that
   change together belong together; things that change independently
   should be free to, without one edit forcing the other to be touched. If
   two modules always change in lockstep, question whether they're really
   one module.
3. **Name for the domain, not the implementation.** A folder named
   `utils/` or `helpers/` is a name that describes nothing — it's where
   things go when no one decided what they actually are. If a file could
   fit in five different folders, that's a sign its actual responsibility
   hasn't been named yet, not that `utils/` is a legitimate category.
4. **A new module earns its own file/folder by having a reason to change
   independently of its neighbors — not by line count.** Splitting a file
   because it's "gotten long" without an actual seam is
   `code-smells`' speculative-generality mistake wearing a different hat.
5. **Public surface should be smaller than total surface.** A module that
   exposes everything (every internal helper, every intermediate type) gives
   callers no signal about what's actually meant to be depended on. Export
   what's meant to be used; keep the rest reachable only from inside.
6. **This overlaps with `systems-architecture` and `code-smells` on
   purpose, at different scales.** `systems-architecture` decides where the
   trust boundary between services sits; this skill decides how one side of
   that boundary organizes its own internals; `code-smells` is what a
   single function or class inside that organization looks like up close.
   A misplaced module is this skill's problem; a bloated function inside a
   well-placed module is `code-smells`'.
