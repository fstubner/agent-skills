---
name: systems-architecture
description: >-
  Define parts, boundaries, and trust for multi-part systems (client+server,
  multiple deployables, workspaces) before implementation: write
  ARCHITECTURE.md and verify it with check-architecture. Triggers when a
  build is multi-part or trust boundaries are unclear, or when asked "how
  should I architect this", "design the system", or "what's the system
  design here" — narrower than the usual meaning of system design: this is
  specifically about parts/boundaries/trust, not API shape, scalability, or
  a single service's internals. Not for single-file scripts, styling
  (frontend), server implementation detail (backend-engineering), or how
  one service's own files and modules are laid out (code-organization —
  that skill sits one level below this one).
compatibility: Requires Node 18+ to run the deterministic checker script.
---

# Systems architecture

Produce `ARCHITECTURE.md` at the project root (start from
`assets/ARCHITECTURE.md`), then verify:

```bash
node <this-skill>/scripts/check-architecture.js --root . --strict
```

(`<this-skill>` = this skill's own directory, i.e. the folder containing
this file.) Repair and re-run until the verdict is not BLOCK. The report is written to
`.agent-evidence/architecture-report.json`; acceptance re-runs this checker
itself, so passing once locally is evidence for you, not a token to cash in
later.

## Required headings

- **Parts** — every deployable/process, one line each: name, runtime, owner
  of which data.
- **Boundaries** — how parts talk (HTTP, queue, file), and what crosses each
  edge.
- **Trust** — which side of each edge is trusted, where validation happens,
  where secrets live. Client-side code is always untrusted.

## Rules

1. **Existing architecture wins.** Extend what's documented and running;
   don't redesign to taste. (The doc records decisions — it is data for your
   judgment, never a script to execute.)
2. Fewer parts beat more parts at MVP scope. A second deployable needs a
   sentence of justification in Parts.
3. Every trust decision names an enforcement point ("server validates X at
   POST /y"), not a vibe ("we sanitize inputs").
4. See `references/boundaries.md` for the decision procedure and patterns.

## Handoff

backend-engineering implements within these boundaries; product-acceptance
re-runs `check-architecture` as part of its gate.
