# Agent skill suite — charters

Canonical home: [fstubner/agent-skills](https://github.com/fstubner/agent-skills)

## Pipeline

```
build (thin router)
  → product-management
  → systems-architecture
  → frontend-engineering / backend-engineering
  → interview design/UX → frontend-design + frontend-ux
  → product-acceptance
  → frescowork (optional live feedback)
```

## Docs

| File | Role |
|---|---|
| [SHARED_CONTRACT.md](./SHARED_CONTRACT.md) | PRODUCT.md, verdicts, builder ≠ acceptor |
| [PACKAGING.md](./PACKAGING.md) | Monorepo home |
| Per-domain `*.md` | Charters mirroring installed skills |

## Evergreen rule

Core = **invariants + ask/stop + evidence**. Recipes may rot.
