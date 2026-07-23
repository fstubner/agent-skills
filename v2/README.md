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

| Skill | Role |
|---|---|
| [`product-build`](./product-build/) | Entry router |
| [`product-management`](./product-management/) | PRODUCT.md contract interview |
| [`systems-architecture`](./systems-architecture/) | Parts, boundaries, trust |
| [`frontend`](./frontend/) | Stack, structure, design, UX |
| [`backend-engineering`](./backend-engineering/) | Trusted-side laws |
| [`product-acceptance`](./product-acceptance/) | Independent acceptance gate |
| [`anti-ai-slop`](./anti-ai-slop/) | Standalone prose editor/detector (not in the pipeline) |

## Pipeline

```
product-build
  → product-management        PRODUCT.md
  → systems-architecture      (multi-part) ARCHITECTURE.md
  → frontend                  interview → design-direction / tokens / ux-walkthrough
  → backend-engineering       (server in scope)
  → implement
  → product-acceptance        separate turn, --acceptor-context separate
```

This ordering is canonical here and only here; skills link to it rather than
restating it.

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
