---
name: backend-engineering
description: >-
  Implement trusted server behavior inside ARCHITECTURE.md: contracts, authz,
  validation, failure modes, observability. Use when writing APIs, data models,
  or server mutations. Stops if system boundaries are undefined.
---

# Backend Engineering

Countermeasure for happy-path servers without contracts or trust.

## Laws

1. **Architecture first** — if multi-part and `ARCHITECTURE.md` is missing, invoke **systems-architecture**.
2. **Contract before code** — request/response or typed handler surface stated up front.
3. **Authz on the trusted side** — every write path states who may act.
4. **Invalid input is designed** — not an afterthought 500.
5. **No silent data loss** — errors actionable; idempotency where retries exist.
6. **Secrets never in clients** — reinforce trust boundary.
7. **Existing server stack wins** — no dual ORMs/frameworks.

## Procedure

1. Read `ARCHITECTURE.md` + `PRODUCT.md`.
2. Implement inside stated parts and edges.
3. For each write path: authz, validation, failure mode.
4. Do not invent a second system topology — update architecture doc if the shape must change.
5. Product SHIP → **product-acceptance**.

## Does not own

UI, visual tokens, frontend stack choice, final product SHIP.
