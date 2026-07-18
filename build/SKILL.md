---
name: build
description: >-
  Thin suite router for building or shipping product UI/apps. Use on greenfield
  apps, "build this", "ship this", or end-to-end feature work. Applies engineering
  and architecture by default; interviews for design and UX instead of inventing
  aesthetics or flows. Not for tiny single-file tweaks inside a locked stack.
---

# Build (suite router)

Keep this skill short. Domain depth lives in sibling skills — do not paste their docs here.

## Defaults (passive engineering)

Do these without waiting to be asked:

1. Read `PRODUCT.md` / `product-brief.md` if present; if app-tier and missing, scaffold from `product-acceptance/templates/PRODUCT.md` and **ask** only what’s unknown.
2. Multi-part (client+server / core third parties) → **systems-architecture** (`profile-architecture` / `ARCHITECTURE.md` / `check-architecture --strict`).
3. Unknown or fragile frontend stack/structure → **frontend-engineering** (`profile-stack` / stack confirm / `check-structure --strict`).
4. Existing stack wins. No React monoculture. No silent vanilla app-tier monoliths.
5. Prefer reuse: one framework, one icon set, one styling paradigm.

Engineering is the default path. Do not skip it to “make it pretty first.”

## Interview (design + UX)

Do **not** invent visual direction or primary flows. Ask briefly, then lock:

**Design (before tokens/chrome polish)** — use **frontend-design** after answers:

- Register: product tool vs brand/marketing?
- Brand accent (hex or match existing)?
- Theme: light / dark / toggle?
- Shell (app): topbar / sidebar / hybrid / none?

**UX (before calling the happy path done)**:

- Primary job in one sentence?
- Who is the user and what’s the first success?
- Critical empty/error states that must exist?

Max one short round (few questions). Then write `design-direction.md` / product fields as needed and continue.

## Order

```
product contract → architecture (if multi) → frontend-engineering (if needed)
                → interview design/UX → frontend-design
                → implement
                → product-acceptance (separate turn; builder ≠ acceptor)
```

Optional later: frescowork for live human preview feedback.

## Stop rules

- Don’t self-SHIP product outcome in the same turn you built it → **product-acceptance**.
- Don’t lock Unknown/vanilla for multi-view apps → **frontend-engineering**.
- Don’t pick aesthetics without the design interview → **frontend-design**.
- Don’t add a second framework, icon library, or parallel system.

## Sibling skills

| Skill | Owns |
|---|---|
| `systems-architecture` | Boundaries, trust, ARCHITECTURE.md |
| `frontend-engineering` | Stack + structure |
| `frontend-design` | Tokens, craft, visual gates |
| `product-acceptance` | Outcome SHIP/BLOCK |

Charters: `~/.cursor/skills/_suite-charters/`.
