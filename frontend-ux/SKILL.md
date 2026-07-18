---
name: frontend-ux
description: >-
  Define primary job paths, interaction states, and whether a user can finish the
  work. Use for flows, forms, empty/error/loading, density, and interaction a11y.
  Interview when the happy path is undefined. Not for tokens, stack, or visual slop.
---

# Frontend UX

Countermeasure for pretty chrome that cannot complete the job.

## Laws

1. **Primary job first** — name the one path that proves the product works.
2. **States are part of the design** — loading, empty, error, success for every data view.
3. **Feedback on mutation** — no silent saves; irreversible actions confirm with named consequence.
4. **Keyboard and focus are UX** — operable without pointer assumptions.
5. **Density matches register** — product tools ≠ marketing storytelling.
6. **Evidence over assertion** — walkthrough or smoke of the primary path.

## Procedure

1. Read `PRODUCT.md` purpose/success (invoke **product-management** if missing).
2. If primary job/states unclear — **ask** (do not invent).
3. Specify path steps + empty/error/success per step before polishing chrome.
4. Visual tokens/type → **frontend-design**. Structure → **frontend-engineering**.
5. Outcome SHIP → **product-acceptance** (this skill feeds evidence, does not self-SHIP).

## Depth (on demand)

For detailed patterns, projects may still have `frontend-design/references/interaction.md` and `accessibility.md` — load those as references, not as a substitute for the laws above.
