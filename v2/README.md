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
claim — that these skills improve agent output — is **not yet measured**:
the [eval](./eval/) is a scaffold with zero recorded runs, and this README
will not say "tested decision procedures" until it has them.

## Skills

This is a composable set, not a pipeline. Each skill fires on its own
trigger and works standalone; skills never call each other directly. Six of
the eight additionally read or write a handful of named artifacts (below) —
that's the entire coupling mechanism.

| Skill | Role |
|---|---|
| [`product-build`](./product-build/) | Dispatcher — for a greenfield/ambiguous request, works out which skills below apply |
| [`product-management`](./product-management/) | PRODUCT.md contract interview |
| [`systems-architecture`](./systems-architecture/) | Parts, boundaries, trust |
| [`frontend`](./frontend/) | Stack, structure, design, UX |
| [`backend-engineering`](./backend-engineering/) | Trusted-side laws |
| [`product-acceptance`](./product-acceptance/) | Independent acceptance gate |
| [`ai-prose-slop`](./ai-prose-slop/) | Prose editor/detector — no artifacts, usable on any writing task |
| [`mental-models`](./mental-models/) | Reasoning lens catalog + triage guide — no artifacts, usable on any hard problem |
| [`the-skeptic`](./the-skeptic/) | Persona — demands evidence before accepting a claim or plan |
| [`the-systems-thinker`](./the-systems-thinker/) | Persona — maps interconnections before proposing a fix |
| [`the-pragmatist`](./the-pragmatist/) | Persona — smallest thing that ships, tradeoffs named |
| [`the-explorer`](./the-explorer/) | Persona — generates genuinely different approaches before judging any |

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
node product-acceptance/scripts/accept-check.js --root . --acceptor-context separate --strict
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
