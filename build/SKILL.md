---
name: build
description: >-
  Default entry skill for building or shipping apps and multi-view product UI.
  Triggers on greenfield, "build this", "ship this", new app, dashboard/tool MVP,
  or end-to-end feature work. Applies product contract, architecture, and frontend
  engineering by default; interviews for design and UX; defers product SHIP to a
  separate acceptance turn. Not for one-line CSS tweaks in a locked codebase.
---

# Build (suite router)

Keep this short. Domain depth lives in sibling skills.

## Passive engineering (do without being asked)

1. **Product** — if `PRODUCT.md` missing or incomplete → **product-management** (ask only unknowns). Required output: `PRODUCT.md`.
2. **Architecture** — if multi-part (server + client, multiple deployables, or trust boundaries) → **systems-architecture** until `check-architecture` is not BLOCK. Required: `ARCHITECTURE.md` + architecture report.
3. **Frontend eng** — if no stack decision, mixed frameworks, or structure gates fail → **frontend-engineering** until structure checks pass. Prefer `suite-profile.json` / stack profile over guessing.
4. **Backend** — if server/API work is in scope → **backend-engineering** inside `ARCHITECTURE.md`.
5. Existing stack wins. No React monoculture. No silent vanilla app-tier monoliths.
6. One framework, one icon set, one styling paradigm.

Do not skip to “make it pretty.”

## Interview design + UX (do not invent)

If visual direction / brand accent / theme is unset → ask, then **frontend-design**.  
If primary job / success / critical empty-error states are unset → ask, then **frontend-ux**.

One short round (batch unknowns). Then lock artifacts and implement.

## Order

```
product-management
→ systems-architecture (when multi-part)
→ frontend-engineering (when stack/structure unknown or failing)
→ interview → frontend-design + frontend-ux
→ backend-engineering (when server in scope)
→ implement
→ product-acceptance (separate turn / acceptor context)
```

## Observable contracts (judgment still in skills)

| Signal | Required skill | Blocks progress until |
|---|---|---|
| No / weak product contract | product-management | `PRODUCT.md` exists |
| Multi-part / trust boundaries | systems-architecture | arch check ≠ BLOCK |
| Unknown or mixed FE stack | frontend-engineering | structure check ≠ BLOCK |
| Visual direction missing | frontend-design | interview locked |
| Primary job / states missing | frontend-ux | interview locked |
| Ship claimed same turn as build | product-acceptance | separate acceptor turn |

Scripts verify measurable evidence; they do not replace judgment.

## Stop rules

- Same-turn self-SHIP → **product-acceptance** next turn instead  
- Unknown/vanilla multi-view → **frontend-engineering**  
- Aesthetics without interview → ask, then **frontend-design**  
- Flows without primary job → ask, then **frontend-ux**  
- Dual framework / dual icons / parallel system → refuse  

## Siblings

`product-management`, `systems-architecture`, `frontend-engineering`, `frontend-design`, `frontend-ux`, `backend-engineering`, `product-acceptance`.  
Charters: `_suite-charters/`.
