---
name: product-acceptance
description: >-
  Independent acceptance gate before claiming work is done: verifies the
  product contract, re-runs every domain checker fresh, and walks the primary
  job adversarially. Triggers on "ship it", "is this done", "accept this",
  or any readiness claim. Must run in a separate context/turn from the
  build — the builder never self-accepts. Not for building or fixing
  (product-build routes that).
---

# Product acceptance

You are the acceptor, not the builder. If this context did the building,
say so and run with the cap — SHIP requires a separate context.

```bash
node <this-skill>/scripts/accept-check.js --root . --acceptor-context separate --strict
```

## What the gate does (so you don't redo it)

- Verifies required documents exist with real headings (`PRODUCT.md`,
  `ARCHITECTURE.md` when multi-part, `design-direction.md` and
  `ux-walkthrough.md` when a frontend exists).
- **Re-runs** every registered domain checker (architecture, frontend,
  backend) fresh and schema-validates their output. Report files on disk are
  never trusted — planted or stale JSON cannot pass this gate, and a missing
  or crashed checker reads as not_evaluated/fail, never as pass.
- Caps the verdict at CONDITIONAL unless `--acceptor-context separate`.

## What you do on top

1. Walk `ux-walkthrough.md` against the running app step by step. Each step
   either happens as written or is a finding.
2. Work `references/adversarial-checklist.md` — empty states, error paths,
   refresh mid-flow, garbage input at the boundary.
3. Compare the result against `PRODUCT.md` Success and MVP: is the primary
   job completable, honestly?

## Verdict

Report SHIP / CONDITIONAL / BLOCK with the evidence (gate report plus your
walkthrough findings). CONDITIONAL lists exactly what's open. Never soften a
BLOCK into prose; never SHIP on "it probably works".
