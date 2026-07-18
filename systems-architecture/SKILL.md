---
name: systems-architecture
description: >-
  Define and verify system boundaries, trust, data flow, and failure modes before
  or while building multi-part apps. Use when designing architecture, APIs between
  client and server, tenancy, integrations, or reviewing whether the system shape
  matches the MVP. Writes ARCHITECTURE.md; runs deterministic architecture gates.
  Not for visual UI polish or picking a frontend framework alone.
---

# Systems Architecture

Countermeasure for LLM “feature soup”: code without boundaries, trust, or failure
thinking. You lock **system shape** in `ARCHITECTURE.md`, then hand implementation
to frontend-engineering / backend-engineering.

**Evergreen rule:** this skill’s identity is **invariants + ask/stop + evidence**.
It does **not** prescribe a cloud vendor, orchestrator, or framework. Dated examples
may live only in `recipes/` and must never become required gates.

Shared vocabulary: `../_suite-charters/SHARED_CONTRACT.md`.

### Scripts

```
node "<SKILL_ROOT>/scripts/profile-architecture.js" [--root .]
node "<SKILL_ROOT>/scripts/check-architecture.js" [--root .] [--strict]
```

## Operating principles

1. **PRODUCT.md first** (or product-brief). Architecture serves the job; it does not invent scope.
2. **Boundaries before cleverness.** Name clients, APIs, stores, workers, third parties.
3. **Trust boundary explicit.** Secrets and privileged operations stay off untrusted clients.
4. **Complexity matches MVP.** Prefer one deployable server + one client until constraints force more.
5. **One write-owner per data** unless a sync rule is documented.
6. **Failure modes are part of the design**, not an afterthought.
7. **Existing architecture wins.** Extend `ARCHITECTURE.md`; don’t start a parallel system.
8. **Evergreen core.** Properties and procedures here; cloud product shortlists go in `recipes/`.

## Workflow

### Phase 0 — Profile

```
node "<SKILL_ROOT>/scripts/profile-architecture.js"
```

Read `architecture-profile.json`: `systemTier`, `needsArchitectureDoc`, `smells`.

### Phase 1 — Decide if architecture is required

| systemTier | ARCHITECTURE.md |
|---|---|
| `single` (static/page, no server, no core external API) | Optional |
| `multi` (client+server, workers, or core third-party path) | **Required** before claiming system-ready |
| `distributed` (≥3 deployables or event mesh) | Required + justify why not simpler |

If `needsArchitectureDoc` and doc missing → interview / write from template → do not deep-implement new integrations first.

### Phase 2 — Write or update ARCHITECTURE.md

Read `references/boundaries.md`. Use `templates/ARCHITECTURE.md`.
Confirm with user when inventing new external dependencies or changing trust boundaries.

### Phase 3 — Verify

```
node "<SKILL_ROOT>/scripts/check-architecture.js" --root . --strict
```

**BLOCK** on strict failures for multi/distributed tiers.

### Phase 4 — Hand off

- UI stack/modules → **frontend-engineering**
- Server implementation → **backend-engineering** (charter / future skill)
- Visual craft → **frontend-design**
- Outcome SHIP → **product-acceptance** (separate turn; consumes architecture report)

## References

| Topic | Read |
|---|---|
| Boundaries, trust, data ownership | `references/boundaries.md` |
| When to stop and ask | `references/decision-procedure.md` |
| Dated infra notes | `recipes/2026.md` |

## Anti-patterns

| Wrong | Right |
|---|---|
| Microservices for a weekend MVP | One API process until a constraint forces split |
| API keys in frontend bundles | Server-side secrets; document trust boundary |
| Two databases “for now” with no sync rule | One write-owner or documented sync |
| Architecture only in chat memory | `ARCHITECTURE.md` in the repo |
| Skipping architecture on Express + SPA | Multi-part → required doc + check |
