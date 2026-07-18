# Structure — property gates

Gates are **properties**, not fashion. Thresholds catch LLM monoliths; adjust with justification in `stack-decision.md` only when the user explicitly accepted a demo shape.

## Target shapes (adapt names to the stack)

### App tier

```
src/   (or framework equivalent: app/, routes/)
  styles/ or tokens/     # global tokens + reset only
  layout/ or shell/      # app chrome once
  components/            # reusable UI
  views/ or routes/      # features composed into the shell
```

Single giant `public/app.js` + `public/styles.css` + mega `index.html` for multi-tab products is a **defect**.

### Page tier

May be fewer modules, but still: no dual frameworks; styles co-located or clearly owned; not unbounded global patch piles.

### Component tier

Co-locate component + styles. Skip app shell scaffolding.

### Explicit demo

If `stack-decision.md` says `shape: throwaway-demo`, monolith HTML is allowed; `check-structure.js` should not BLOCK on LOC (warn only).

## Property gates

| ID | Property | App-tier BLOCK when |
|---|---|---|
| `P-dual-framework` | At most one app framework | Two of react/vue/svelte/angular/solid as runtime deps without a documented bridge |
| `P-dual-icons` | One icon system | ≥2 of lucide / font-awesome / heroicons / material-icons CDN or packages |
| `P-monolith-js` | JS modularized | Any single `.js`/`.ts`/`.tsx`/`.jsx` (excl. minified/vendor) > 400 lines under app entry paths without a module tree |
| `P-monolith-css` | CSS modularized | Any single non-token `.css` > 400 lines for app tier without modules/partials |
| `P-unknown-stack` | Stack decided | Framework unknown/vanilla and no `stack-decision.md` |
| `P-components-dir` | Reuse surface exists | App tier and no components/routes/views directory analogue |

## What “good” looks like

- Blast radius localized (change one view without rewriting the shell)
- Layout primitives / composition over one-off margins
- Tokens for color/spacing (design skill owns token files; eng ensures they are referenced, not duplicated hex soup in every file)

## Handoff

Structure green → frontend-design may own visual polish. Structure red → do not claim ready for product-acceptance.
