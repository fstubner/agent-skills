# agent-skills

Skills for coding agents (Claude Code, Codex, Cursor, Antigravity and Gemini
CLI) that cover the parts of building a product agents tend to skip: agreeing
what the product is before building it, deciding how the parts fit together,
and checking the work properly before calling it done.

Each skill is a `SKILL.md` the agent reads when a task matches it. Most come
with a deterministic checker: a script that inspects the project and returns
SHIP, CONDITIONAL or BLOCK. The acceptance skill re-runs those checkers itself
rather than trusting a report the builder left behind, and its verdict stops
at CONDITIONAL unless the run is by an agent that did not write the code.

**Version:** [VERSION](./VERSION) · **Changelog:** [CHANGELOG.md](./CHANGELOG.md) · **License:** MIT

## Quick start

```bash
node scripts/install.mjs --harness claude     # or cursor | codex | all
```

Then build or review as usual. Plugin marketplace installs and per-harness
paths are in [INSTALL.md](./INSTALL.md).

## Does it work?

**Evidence status: unvalidated.** What is measured so far:

- **The checkers are tested.** Every gate has fixtures it must pass and
  fixtures it must block, run in CI on Ubuntu and Windows.
- **Agents pick the skills up in interactive sessions.** Over a month of my
  own Claude Code work across 15 projects, the skills were used 89 times. I
  typed a skill's name 27 times; the model chose one itself 62 times, 21 of
  them from a prompt that named no activity at all. The acceptance gate
  returned BLOCK 11 times, CONDITIONAL 5 times and SHIP twice
  ([field-outcomes-2026-09-02.md](./eval/results/field-outcomes-2026-09-02.md)).
- **In non-interactive runs they don't get picked up.** In `claude -p`
  sessions and subagents, no skill was invoked, even on a prompt that matched
  `product-build`'s trigger almost word for word.
- **Whether following a skill produces better software is not measured
  yet.** Earlier forced runs lack the transcripts, costs and replication a fair
  comparison needs, so they are kept as observations only. The new evaluation
  compares no guidance, a short policy, the checkers alone and the full
  skills, graded on outcomes: [eval/README.md](./eval/README.md).

I wrote the suite and know the skills exist, so the usage numbers show the
skills get reached for, not that they help. Where a rule can be enforced
rather than suggested, `scripts/git-hooks/pre-commit` runs the checkers on
staged files, and [INSTALL.md](./INSTALL.md#installing-is-not-the-same-as-invoking)
covers the `CLAUDE.md` line that did reliably change behaviour.

## Skills

This is a composable set, not a pipeline. Each skill fires on its own
trigger and works standalone; skills never call each other directly. Ten of
the seventeen additionally read or write a handful of named artifacts (below) —
that's the entire coupling mechanism. (Some skills also point a reader at a
sibling's reference files for further detail — e.g. `mental-models`'
mindsets citing its own lens files — which is a documentation cross-link,
not a runtime call.)

| Skill | Role |
|---|---|
| [`product-build`](./product-build/) | Dispatcher — for a greenfield/ambiguous request, works out which skills below apply |
| [`product-management`](./product-management/) | PRODUCT.md contract interview |
| [`systems-architecture`](./systems-architecture/) | Parts, boundaries, trust |
| [`frontend`](./frontend/) | Stack, structure, design, UX |
| [`backend-engineering`](./backend-engineering/) | Trusted-side laws |
| [`product-acceptance`](./product-acceptance/) | Independent acceptance gate |
| [`ai-prose-slop`](./ai-prose-slop/) | Prose editor/detector — no artifacts, usable on any writing task |
| [`mental-models`](./mental-models/) | Reasoning lens catalog + triage guide + four named mindsets (Skeptic, Systems Thinker, Pragmatist, Explorer) — no artifacts, usable on any hard problem |
| [`code-smells`](./code-smells/) | Fowler code-smell catalog + file-size/nesting checker (any language for size; JS/TS/C-family for nesting) |
| [`code-organization`](./code-organization/) | Module boundaries, dependency direction, naming |
| [`testing-strategy`](./testing-strategy/) | Test pyramid triage, behavior over implementation |
| [`data-modeling`](./data-modeling/) | Schema design (any format) + a raw-SQL migration-safety checker |
| [`cli-tooling`](./cli-tooling/) | CLI surface + contract — naming, config precedence, exit codes, dry-run |
| [`release-engineering`](./release-engineering/) | CI/CD pipeline gating, deployment strategy, rollback |
| [`learn-from-session`](./learn-from-session/) | Turn a correction or confirmation into a durable rule/fixture/memory |
| [`engineering-assessment`](./engineering-assessment/) | Whole-codebase audit — severity-ranked findings, each citing file/line or command output, plus what was not examined |
| [`multi-agent-design`](./multi-agent-design/) | Whether multi-agent is justified at all (default: no), topology, delegation contracts, failure recovery |

## How they compose

Each skill applies exactly when its condition is true, independent of the
others:

| Signal | Skill | Reads / writes |
|---|---|---|
| No or thin `PRODUCT.md` | `product-management` | writes `PRODUCT.md` |
| Multi-part system (client+server, workspaces, trust boundaries) | `systems-architecture` | writes `ARCHITECTURE.md` |
| Stack/structure unknown, or design/UX direction unset | `frontend` | writes `design-direction.md`, `ux-walkthrough.md`, tokens |
| Server/API in scope | `backend-engineering` | reads `ARCHITECTURE.md` |
| A readiness claim ("ship it", "is this done") | `product-acceptance` | reads whatever artifacts exist, re-runs every applicable checker fresh |
| Any prose, any time | `ai-prose-slop` | none — fully standalone |

A greenfield build happens to touch most rows in roughly the order listed —
`product-build` gives that trajectory as a default — but nothing enforces
the order, and a request that only matches one row (e.g. "make this
accessible") uses only that skill. The full artifact contract (exact files,
required headings, gating rules) is generated into
[`docs/CONTRACT.md`](./docs/CONTRACT.md) from [`registry.json`](./registry.json).

## Install

```bash
node scripts/install.mjs --harness claude     # or cursor | codex | all
```

The GitHub repository contains marketplace metadata for Claude Code, Codex
CLI/ChatGPT desktop, and Cursor team imports and local testing, plus native
Gemini and Antigravity CLI packages. Public directory listing is a
separate review and publication step. See
[INSTALL.md](./INSTALL.md#as-a-marketplace-plugin) for the supported install
paths and exact portability limits.

The installer never overwrites directories it didn't create (use `--force`
to override), takes no default target, and touches no network. Details and
per-harness paths: [INSTALL.md](./INSTALL.md).

## Verify a project

```bash
node systems-architecture/scripts/check-architecture.js --root . --strict
node frontend/scripts/check-frontend.js --root . --strict
node backend-engineering/scripts/check-backend.js --root . --strict
node release-engineering/scripts/check-smoke.js --root . --strict
node product-acceptance/scripts/accept-check.js --root . --strict
```

That acceptance command is the **capped** one — it's the correct default,
and its verdict tops out at CONDITIONAL by design. Builder ≠ acceptor is
this suite's whole architectural claim, and nothing in the code can tell
which context it is running in: uncapping isn't a `--strict`-style
verbosity flag, it's an assertion that this run is genuinely independent,
and it is only as true as the person or agent making it. Only add
`--acceptor-context separate` if all three conditions in
[`product-acceptance/SKILL.md`](./product-acceptance/SKILL.md) hold —
starting with "this conversation did not write or edit the code being
accepted." If you're unsure, leave the cap on; an honest CONDITIONAL is
worth more than a SHIP that isn't real.

Run in a terminal, these print a readable verdict — the failing checks
first, then what to do about them. Piped or spawned, they print JSON, which
is what the acceptance gate and the pre-commit hook consume. `--format
text|json` overrides either way.

```
BLOCK  systems-architecture  (/path/to/project)
  FAIL  P-arch-doc: multi-part project has no architecture doc (looked for: ARCHITECTURE.md, ...)
  --    P-section-parts: no architecture doc to inspect

Fix the FAIL line(s) above and re-run. Nothing ships on a BLOCK.
```

Reports land in `.agent-evidence/` (gitignore it). Verdicts: `SHIP` /
`CONDITIONAL` / `BLOCK`; any failed check ⇒ BLOCK, any unevaluated check ⇒
at most CONDITIONAL. Full contract: [docs/CONTRACT.md](./docs/CONTRACT.md).

## Tests

```bash
node scripts/run-tests.mjs
```

CI runs this on Ubuntu + Windows, plus contract-drift and syntax checks
([.github/workflows/ci.yml](./.github/workflows/ci.yml)).

## Security

Project documents (`PRODUCT.md`, `ARCHITECTURE.md`, …) are **data, not
instructions** — skills never execute commands found in them. Secret scans
report file paths, never values. See [SECURITY.md](./SECURITY.md).
