# Agent skill suite — charters

Local planning package for evergreen skill countermeasures. **Not published to GitHub until charters stabilize.**

## Pipeline

```
build (thin router)
  product-management → systems-architecture
                     → frontend-engineering / backend-engineering
                     → interview design/UX → frontend-design (+ ux charter)
                     → product-acceptance
                     → frescowork (optional live feedback)
```

**build** skill: engineering by default; interview for design/UX; does not restate domain docs.

## Docs

| File | Role |
|---|---|
| [SHARED_CONTRACT.md](./SHARED_CONTRACT.md) | PRODUCT.md fields, verdicts, builder ≠ acceptor |
| [product-management.md](./product-management.md) | Brief / interview |
| [systems-architecture.md](./systems-architecture.md) | Boundaries, trust, failure modes |
| [frontend-engineering.md](./frontend-engineering.md) | Stack procedure + structure gates |
| [frontend-design.md](./frontend-design.md) | Visual system only |
| [frontend-ux.md](./frontend-ux.md) | Flows, states, job completion |
| [backend-engineering.md](./backend-engineering.md) | Server contracts as properties |
| [product-acceptance.md](./product-acceptance.md) | Adversarial outcome review |
| [PACKAGING.md](./PACKAGING.md) | Monorepo deferred |

## Evergreen rule

Core skill body = **invariants + ask/stop + evidence**.  
Framework CLIs and library shortlists live in dated `recipes/` and may rot.

## Installed skills (Cursor)

| Skill | Path |
|---|---|
| build | `~/.cursor/skills/build/` (thin router) |
| frontend-design | `~/.cursor/skills/frontend-design/` |
| frontend-engineering | `~/.cursor/skills/frontend-engineering/` |
| systems-architecture | `~/.cursor/skills/systems-architecture/` |
| product-acceptance | `~/.cursor/skills/product-acceptance/` |

Product-management, frontend-ux, and backend-engineering start as charters; promote to skill folders when depth demands it.
