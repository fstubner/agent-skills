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

1. **Product** — read or create `PRODUCT.md` via **product-management** (ask only unknowns).
2. **Architecture** — multi-part → **systems-architecture** until `check-architecture` is not BLOCK.
3. **Frontend eng** — unknown/fragile stack → **frontend-engineering** until structure gates pass.
4. **Backend** — server work → **backend-engineering** inside `ARCHITECTURE.md`.
5. Existing stack wins. No React monoculture. No silent vanilla app-tier monoliths.
6. One framework, one icon set, one styling paradigm.

Do not skip to “make it pretty.”

## Interview design + UX (do not invent)

**Design** → then **frontend-design**: register, brand accent, theme, shell (app).  
**UX** → then **frontend-ux**: primary job, user/success, critical empty/error states.

One short round. Then lock artifacts and implement.

## Order

```
product-management → systems-architecture (if multi)
                   → frontend-engineering (if needed)
                   → interview → frontend-design + frontend-ux
                   → backend-engineering (if server)
                   → implement
                   → product-acceptance (separate turn)
```

## Stop rules

- Same-turn self-SHIP → **product-acceptance** next turn instead  
- Unknown/vanilla multi-view → **frontend-engineering**  
- Aesthetics without interview → ask, then **frontend-design**  
- Flows without primary job → ask, then **frontend-ux**  
- Dual framework / dual icons / parallel system → refuse  

## Siblings

`product-management`, `systems-architecture`, `frontend-engineering`, `frontend-design`, `frontend-ux`, `backend-engineering`, `product-acceptance`.  
Charters: `_suite-charters/`.
