---
name: frontend
description: >-
  Frontend stack, structure, visual design, and UX in one skill: pick or
  verify the stack, interview for visual direction and the primary user job
  (never invent either), write design-direction.md, design-tokens.json, and
  ux-walkthrough.md, and verify with check-frontend. Triggers on UI work —
  components, pages, styling, CSS/Tailwind, tokens, contrast, layout, "make
  this look better", flows, or empty/error states. Not for the product
  contract (product-management), server logic (backend-engineering), or
  accepting finished work (product-acceptance).
---

# Frontend

Owns four artifacts: `stack-decision.md` (when the stack was open),
`design-direction.md`, `design-tokens.json`, `ux-walkthrough.md`. Verify with:

```bash
node <this-skill>/scripts/check-frontend.js --root . --strict
```

## Interview first — never invent

If visual direction (brand accent, mood, density) or the primary user job
(what one thing must succeed, what empty/error look like) is unset: **ask**.
One batched round of questions, then lock the artifacts. Aesthetics without
an interview and flows without a primary job are stop signals, not license
to improvise.

## Engineering laws

1. Existing stack wins. One framework, one icon system, one styling paradigm
   — the checker blocks on splits (`F-dual-framework`, `F-dual-icons`).
2. Stack open? Decide per `references/stack-selection.md`, record one page in
   `stack-decision.md` (choice, two runners-up, why).
3. Structure follows the framework's convention; don't hand-roll a bundler
   setup when the framework ships one.

## Design laws

1. All color through `design-tokens.json`; `text-main`/`surface-base` are
   required and must clear WCAG 4.5:1 (`F-tokens-contrast` blocks otherwise;
   with no token file at all the check reports not_evaluated and the verdict
   caps at CONDITIONAL — locking design is part of shipping).
2. Direction before decoration: `design-direction.md` records mood, accent,
   type scale, density. See `references/design-principles.md`.

## UX law

`ux-walkthrough.md` walks the primary job step by step and states what
empty, error, and success look like at each step. Falsifiable steps —
"click New, type a name, press Enter, row appears" — not narrative. See
`references/ux-states.md`.

## Handoff

product-acceptance requires all frontend artifacts present and re-runs
`check-frontend` itself.
