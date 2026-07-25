# Stack selection

## Rule zero

**Existing stack wins.** If the project has a working framework, styling
approach, or build setup, extend it. Rewrites need the human's explicit
go-ahead recorded in `stack-decision.md`.

## When the stack is open

Pick by project shape, not habit:

| Shape | Default | Because |
|---|---|---|
| Multi-view app / dashboard / tool | React + Vite, or the team's known framework | Ecosystem, hiring, component reuse |
| Content site, few interactions | Astro or plain HTML+CSS | Ship less JavaScript |
| Single interactive widget | Vanilla or Preact | A framework is overhead here |
| Server-rendered product with auth | Next.js (or team equivalent) | Routing, data, deploy story included |

"The team already knows X" outranks every row above.

## Record it

One page in `stack-decision.md`: the choice, two runners-up, and why —
including the constraint from `PRODUCT.md` that drove it, if one did.

## Hard rules

- One framework. One icon system. One styling paradigm. The checker blocks
  splits; migrations count as one plus a written plan.
- No vanilla multi-view apps by accident — vanilla is a decision with a
  rationale, or it's a smell.
- Don't add a state library, CSS framework, or component kit until a
  concrete pain names it.
