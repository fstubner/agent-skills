---
name: repo-docs
description: >-
  Draft and check the documents a visitor reads in a repository (README,
  release notes, CHANGELOG entries, INSTALL, CONTRIBUTING, SECURITY, docs/
  pages and ADRs) so they are consistent, factual and professional. Writes
  from the project's own sources of truth, never from memory, and is not done
  until check-docs passes: no dashes, semicolons or inline colons in prose,
  no third-person references to the author, no filler connectives, no dated
  history in descriptive docs, a README shaped for its project type, ADRs with
  every required section, and release notes that only quote figures the
  changelog recorded. Triggers on "write the README", "draft release notes",
  "update the changelog", "write an ADR", "clean up the docs", or before a
  release. Not for judging general prose quality (ai-prose-slop), deciding
  what the architecture or product is (systems-architecture,
  product-management), or code comments.
compatibility: Requires Node 18+ to run the deterministic checker script.
---

# Repository documentation

Every document this skill writes is finished only when the checker passes:

```bash
node <this-skill>/scripts/check-docs.js --root . --format text
```

(`<this-skill>` is the folder containing this file.) It reads README,
INSTALL, CONTRIBUTING, SECURITY, RELEASE, SUPPORT, PRODUCT.md,
ARCHITECTURE.md, everything under `docs/`, ADRs, and the `[Unreleased]`
section of CHANGELOG.md. Fix every FAIL line and re-run. A draft that reads
well to you but fails the checker is not done, and a draft that passes is
still yours to read once more for the judgment rules below.

## Write from sources, not memory

Before drafting, read what the document describes. For a README that is the
code, the manifest, the install script and any registry. For release notes it
is the changelog section being released. For an ADR it is the decision as the
person who made it stated it. A sentence you cannot point at a source for is
a sentence to cut, and a figure you cannot point at is never written.

## Voice

These hold for every document the checker reads.

1. **No dashes, semicolons or inline colons in prose.** Split the sentence,
   or join the parts with "and" or "so". A literal string that contains a
   colon, like a menu command, goes in backticks. A colon ending a line that
   introduces a list or a code block is allowed.
2. **First person, never third.** The author is "I" on a solo project and
   "we" on a team, never "the author" or "the maintainer".
3. **No filler connectives.** `plus`, `additionally`, `furthermore`,
   `moreover`, `rather than`, `as well as` and `along with` are cut. Start a
   new sentence instead.
4. **Describe what is, not how it got here.** A README, install guide or
   docs page states what the project does and how to use it. The incident
   that led to a rule, the bug a section once had, the date something
   changed, all go in the CHANGELOG, the commit message or an ADR.
5. **State Y without staging it against X.** Write `Skills share a few
   files`, not `Skills share files rather than calling each other`.
6. **One example, not three.** Pick the clearest case and drop the rest.
7. **No bold thesis sentence opening every bullet.** A bold lead is for
   scanning a list of items with names, like checks or files. A list of
   changes reads better as plain sentences.

Rules 5 to 7 are judgment. The checker catches 1 to 4. Read the draft once
more for the rest, and run `ai-prose-slop` on it for general prose habits.

A repository can turn individual checks off with `.docs-style.json`
(`{ "disable": ["D-connectives"] }`). Do that only when the owner asks.

## The documents

Each has a reference with its shape and a template in `assets/`.

| Document | Reference | Template |
|---|---|---|
| README | [references/readme.md](references/readme.md) | `assets/README.md` |
| Release notes | [references/release-notes.md](references/release-notes.md) | `assets/RELEASE_NOTES.md` |
| CHANGELOG entry | [references/changelog.md](references/changelog.md) | |
| ADR | [references/adr.md](references/adr.md) | the ADR template in the systems-architecture skill |
| INSTALL, CONTRIBUTING, SECURITY, docs pages | [references/supporting-docs.md](references/supporting-docs.md) | |

## Release notes

Release notes are a reader's version of one CHANGELOG section. Write the
CHANGELOG entry first, then the notes from it, then check the two together:

```bash
node <this-skill>/scripts/check-docs.js --root . --release-notes NOTES.md --section 0.3.0
```

`D-release-numbers` fails on any figure in the notes that the section never
recorded. Shorten the section freely. Never add a number to it.

## What this skill does not do

- It doesn't decide what the product or architecture is. PRODUCT.md belongs
  to `product-management`, ARCHITECTURE.md and the ADR template to
  `systems-architecture`. This skill checks their voice and ADR structure.
- It doesn't judge whether prose is good, only whether it breaks the rules
  above. `ai-prose-slop` covers inflated vocabulary and model habits.
- It doesn't generate notes or changelogs from commits. The CHANGELOG is
  written by a person and is the source of truth.
- It doesn't touch code comments or commit messages.
