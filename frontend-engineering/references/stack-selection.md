# Stack selection — decision procedure

Evergreen procedure. Shortlists in `recipes/` may change; this process does not.

## Rule 0 — Existing wins

If `package.json` / config already identifies a framework (Next, Nuxt, SvelteKit, Astro, Vite+X, Angular, WordPress theme, etc.):

- **Use it.** Do not start a parallel app.
- Use the existing icon set and UI kit if present.
- Document in `stack-decision.md` as `status: existing`.

## Rule 1 — Classify the job

From PRODUCT.md / brief / user ask, pick the dominant job shape:

| Job shape | Signals |
|---|---|
| **Content / brand** | Landing, marketing, blog, docs, portfolio |
| **App / tool** | Auth, multi-view, dashboards, settings, CRUD, real-time UI |
| **Docs product** | Documentation site, API reference |
| **CMS-bound** | WordPress / existing CMS is the delivery vehicle |
| **Throwaway demo** | Explicit one-shot, spike, or throwaway prototype |

## Rule 2 — Map job → family (not a specific brand of React)

| Job shape | Prefer family | Avoid |
|---|---|---|
| Content / brand | Content-first meta (e.g. Astro) or existing docs tool; islands only where interactive | Full SPA for mostly static pages |
| App / tool | App meta-framework or Vite SPA **chosen by constraints** (SvelteKit, Next, Nuxt, Remix, Vite+Svelte/Vue/Solid/React, etc.) | Silent single-file HTML for multi-view products |
| Docs product | Docs framework already in ecosystem (Starlight, Docusaurus, VitePress, …) or Astro | Custom docs chrome from scratch |
| CMS-bound | That CMS’s native front (themes/blocks/templates) | Second unrelated SPA unless required |
| Throwaway demo | Single HTML **or** tiny Vite — only when user accepts throwaway | Pretending a demo is production structure |

**There is no default winner.** React appears only when constraints or ecosystem fit demand it.

## Rule 3 — Tie-breakers (constraints)

Apply in order; stop when one decides:

1. **Must-use** stated by user or PRODUCT.md `## Constraints`
2. **Team / deploy** already standardized
3. **SEO + server data** critical → SSR-capable meta-framework
4. **Client-only, max simplicity** → Vite SPA with the lightest UI runtime that fits
5. **UI kit already chosen** → framework that kit assumes
6. **Smaller runtime / less boilerplate preferred** and no other constraint → prefer lighter runtimes (e.g. Svelte/Solid) over heavier ones
7. **Still ambiguous** → ask once with **one** recommendation + one alternative, not five equals

## Rule 4 — Libraries and SDKs

After framework family is locked:

- Router, data, forms: prefer the framework’s idiomatic defaults or what the repo already uses
- Icons: **one** set
- CSS: **one** paradigm (Tailwind **or** CSS Modules **or** scoped SFC styles — not all three as systems)
- UI kit: only if it fits the framework; do not add MUI + shadcn + custom DS together

## Rule 5 — Confirm and record

Propose in one short block:

```text
Recommendation: <stack>
Why: <job shape + 1–2 constraints>
Override if: <when user should pick something else>
```

After user confirms (or “existing”), write `stack-decision.md`.

## Anti-defaults

- Do not default to React + shadcn
- Do not default to purple admin chrome (that is design, and wrong as an eng default)
- Do not treat `Unknown / vanilla` as sacred for app-tier greenfield
