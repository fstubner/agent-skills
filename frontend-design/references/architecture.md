# Architecture: Composable, Maintainable, Agent-Readable UI

A beautiful interface that's unmaintainable is a failure. The code you write today is the context
the next human — or agent — reads tomorrow. Tangled, one-off CSS becomes a toxic context that
breeds more one-off CSS. Build a predictable system instead.

> **Stack and module scaffolding** for greenfield / unknown frameworks are owned by the
> **frontend-engineering** skill (`stack-decision.md`, structure gates). This document covers
> **visual and CSS ownership** once a stack is locked — composition, blast radius, token use.

## 1. Localize the blast radius

A change to one component should not ripple into unrelated views.

- **Co-locate** a component's markup, logic, and styles (single-file component, CSS Module, or a
  `ComponentName/` folder). Don't scatter a component's styles into a global stylesheet.
- **Zero magic numbers.** Colors, spacing, radii, shadows, type sizes, and durations come from
  tokens. A raw hex or px in component code is a defect (see `design-systems.md`).
- **Keep specificity flat.** Cap selector nesting at ~3 levels. Deep descendant selectors
  (`.a .b .c .d button`) create fragile, high-specificity coupling. Prefer a single meaningful
  class (BEM, utility classes, or scoped styles) over relational matching.

## 2. Composition over custom layout

This is the rule that prevents "custom crap on top of custom crap":

- **Components don't set their own outer margins.** Outer spacing between siblings is the parent
  layout's job. A component that hardcodes `margin-top` breaks the moment it's reused elsewhere.
- **Compose with layout primitives.** Use a small set of reusable layout components:
  - **Stack** — vertical/horizontal flow with a `gap` token (Flexbox).
  - **Grid** — multi-column structured layouts (CSS Grid).
  - **Cluster / Inline** — wrapping rows of items (chips, tags, actions).
  - **Center / Container** — constrain measure and center content.
- Drop atomic components into these primitives; let `gap` handle rhythm. This yields consistent
  alignment automatically, everywhere.

```
Brittle:  a <Sidebar> that hardcodes its width, padding, logo, and item margins
Clean:    a <Sidebar> layout slot that accepts <NavLinks>, <Divider>, <UserCard> as children,
          spaced by a Stack with a gap token
```

## 3. The app shell

Define the global skeleton once (header / sidebar / content via CSS Grid) and never re-implement
it per page. Views compose into the shell's content slot. Page-specific layout lives in the view,
not in the shell.

**Delegate the full mental model** — navigation tiers, settings placement, header anatomy, shell
layouts — to `app-shell.md`. Read it whenever building or refactoring global chrome.

## 4. Predictable file structure

Make the layout guessable so any agent can navigate it without a full search:

```
src/
├── styles/ (or tokens/)   # design tokens + global resets only
├── layout/                # app shell + layout primitives (Stack, Grid, Container)
├── components/            # atomic, reusable UI (Button, Input, Card) — self-contained
└── views/ (or routes/)    # features composed from components inside the shell
```

Adapt names to the project's existing convention; consistency matters more than the exact names.

## 4b. CSS ownership and regression blast radius

When a project has **theme overrides**, **framework defaults** (Starlight, MUI, etc.), and **custom
surfaces** (landing, docs, admin), monolithic global CSS becomes a regression factory.

- **One surface, one owner file** — docs layout rules do not live next to landing hero styles.
- **Global file = tokens + resets only** — not feature-specific layout patches.
- **Stop after two global patches** in the same area — refactor the owning layout (`regression-guardrails.md`).
- **Verify all viewports** touched by a selector — a `min-width` fix for desktop must not break tablet.

See `regression-guardrails.md` for layout invariants, screenshot checklists, and an `AGENTS.md` block
projects can paste.

## 5. State via semantic hooks

Expose UI state declaratively so both assistive tech and future agents can target it without
guessing at class names:

- Use `data-state="loading|empty|active|open"` and ARIA attributes (`aria-busy`, `aria-expanded`,
  `aria-selected`) to drive conditional styling.
- Style off those hooks (`[data-state="loading"] { ... }`) instead of inventing
  `.is-loading-v2`-style classes that the next person can't trust.
- Prefer native semantic elements (`<button>`, `<nav>`, `<dialog>`, `<form>`, `<details>`) over
  `<div>` soup — they bring behavior, accessibility, and meaning for free.

Semantic HTML + state hooks already make a UI far easier for browser agents to operate. If a
project explicitly targets agentic browsing, dedicated APIs (e.g. WebMCP) can expose callable
tools as progressive enhancement on top of solid semantic markup — see `resources.md`.

## 6. Responsiveness

**Read `responsive-design.md`** for the full mental model. Summary:

- Design mobile-first; layer enhancements up with `min-width` queries or container queries.
- Prefer intrinsic/fluid layout (Grid `auto-fit`/`minmax`, `clamp()` for fluid type/space) over
  a pile of fixed breakpoints.
- Interactive targets ≥ ~44×44px for touch.
- **Use logical properties** (`margin-inline`, `padding-block`, `inset`, `text-align: start`) and
  `gap` rather than physical left/right offsets, so layouts mirror correctly in RTL locales.
- **Media:** give images/embeds an `aspect-ratio` (or intrinsic `width`+`height`) to reserve space
  and prevent layout shift; serve responsive images with `srcset`/`sizes` or `<picture>`; use
  `object-fit: cover` for crops.
- **Viewport units:** prefer `dvh`/`svh` over `vh` for full-height mobile layouts so content
  doesn't jump when the browser UI shows or hides.

## 7. Interaction-to-paint responsiveness

Give immediate visual feedback to any interaction *before* awaiting async work — flip the button
to a loading/disabled state synchronously, then start the network call. The UI should never look
frozen while JavaScript or a request is in flight. (This is what keeps perceived responsiveness
high; see the INP guidance linked in `resources.md`.)

## 8. Performance is a design constraint (Core Web Vitals)

Design choices decide these scores — treat them as outcomes you own (specifics: web.dev / Baseline
in `resources.md`):

- **LCP (loading):** the main image or heading must paint fast — size and lazy-load below-the-fold
  images, preload the hero, and use `font-display: swap` (see `typography.md`).
- **CLS (stability):** reserve space for anything that arrives late — `aspect-ratio` on media,
  skeletons matching the final layout, and never inject content above existing content.
- **INP (responsiveness):** see §7 — synchronous feedback before async work.
