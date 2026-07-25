# agent-skills v2

**Version:** [VERSION](./VERSION) · **Changelog:** [CHANGELOG.md](./CHANGELOG.md) · **License:** MIT

Agent Skills suite for product UI work (Cursor / Claude Code / Codex), built
around three ideas:

- **Evidence-gated shipping** — deterministic checkers emit unified reports;
  the acceptance gate **re-runs them fresh** and never trusts JSON on disk.
- **Builder ≠ acceptor** — SHIP is unreachable from the context that built.
- **Registry-first contract** — [`registry.json`](./registry.json) is the
  single machine-readable source for skills and artifacts;
  [`docs/CONTRACT.md`](./docs/CONTRACT.md) is generated from it and CI fails
  on drift.

## What we claim (and don't)

The **checkers are tested**: every gate has ship + block fixtures asserting
the specific blocker, run in CI on Ubuntu **and Windows**. The behavioral
claim — that these skills improve agent output — has now been measured
twice ([eval/results/](./eval/results/), case `okr-tool`), and the honest
result is **not good**: in both a Task-tool subagent and a genuine top-level
`claude -p` session, with all 15 skills installed from a tagged release,
neither run invoked a single skill on a prompt that matches `product-build`'s
own stated trigger almost verbatim. No `PRODUCT.md`, no `ARCHITECTURE.md`, no
design question asked, and the builder self-certified "done" in the same
turn it built. The checkers work when run; getting an agent to run them
unprompted is an open, unsolved problem — see the eval notes for detail. Do
not read "the checkers are tested" as "the skills change agent behavior."

## Skills

This is a composable set, not a pipeline. Each skill fires on its own
trigger and works standalone; skills never call each other directly. Nine of
the fifteen additionally read or write a handful of named artifacts (below) —
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

The installer never overwrites directories it didn't create (use `--force`
to override), takes no default target, and touches no network. Details and
per-harness paths: [INSTALL.md](./INSTALL.md).

## Verify a project

```bash
node systems-architecture/scripts/check-architecture.js --root . --strict
node frontend/scripts/check-frontend.js --root . --strict
node backend-engineering/scripts/check-backend.js --root . --strict
node product-acceptance/scripts/accept-check.js --root . --strict
```

That acceptance command is the **capped** one — it's the correct default,
and its verdict tops out at CONDITIONAL by design. Builder ≠ acceptor is
this suite's whole architectural claim: SHIP is unreachable from the
context that built, so uncapping it isn't a `--strict`-style verbosity
flag, it's a claim that this run is genuinely independent. Only add
`--acceptor-context separate` if all three conditions in
[`product-acceptance/SKILL.md`](./product-acceptance/SKILL.md) hold —
starting with "this conversation did not write or edit the code being
accepted." If you're unsure, leave the cap on; an honest CONDITIONAL is
worth more than a SHIP that isn't real.

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
