# Regression Guardrails: System-Driven UI, Not Patch-Driven CSS

Real projects fail when UI work becomes **reactive**: fix the screenshot in front of you, add another
global override, move on. One viewport improves; another breaks. The fix is not "be more careful" —
it is **ownership, invariants, and verification that fails before merge**.

This reference encodes lessons from production regressions (docs layouts pushed hundreds of pixels
down, mobile fixes leaking to desktop, monolithic theme overrides fighting each other).

## The failure mode

| Symptom | Typical cause |
|---|---|
| Main content starts far below the header | `position: sticky` on a **full-height sidebar column** — sticky does **not** remove the element from flow; it still reserves its height and pushes siblings down |
| Mobile fix breaks desktop | One broad selector or breakpoint block touched multiple surfaces |
| "Fixed" three times, still broken | Late overrides piled into a global file; specificity war |
| Agent reports done, user sees garbage | Build passed but no screenshots or layout metrics at affected viewports |

**Sticky sidebar trap (concrete):** A docs site used `position: sticky` on `.sidebar-pane` so the nav
would "stay visible." On desktop the sidebar still occupied its full column height in normal flow, so
`.main-frame` was pushed down by ~sidebar height. Fix: **viewport-lock flex shell** (`app-shell.md`
§8) or `position: fixed` on the column **with** explicit offset on main — not sticky on the shell
sidebar. See `sticky-and-scroll.md` Step 2.

## System-driven rules (always apply)

### 1. Identify the owner before editing

Before changing layout or styling:

1. Which **surface** owns this behavior? (landing, docs shell, docs nav, search modal, table, …)
2. Which **file** should own the change? (narrowest scope — not "global.css" by default)
3. Which **scroll container** moves? (`sticky-and-scroll.md` Step 1)
4. Which **viewports** does this selector affect? (desktop, tablet, mobile — verify all three)

### 2. CSS ownership

**Global styles** may only define: tokens, resets, typography defaults, and truly shared primitives.

Everything else goes in the **narrowest owning file**:

| Surface | Owns |
|---|---|
| App / site shell | `site-shell.css`, layout component, or shell module |
| Docs layout (sidebars + main) | `docs-layout.css` or equivalent |
| In-page nav / ToC | `docs-nav.css` |
| Search overlay | `search.css` |
| Tables / code blocks | shared component CSS |
| Feature pages | page or route-scoped styles |

Co-locate with components when the stack supports it (`architecture.md` §1). The goal is not "more
files" — it is **obvious blast radius** so a docs nav fix cannot accidentally restyle tables.

### 3. One surface at a time

When fixing docs mobile nav, do **not** also touch table styling, search, landing nav, and changelog
unless the task explicitly requires it. Cross-surface edits are how regressions propagate.

### 4. Stop condition — refactor, don't patch

> If more than **two** visual fixes in the same area require **broad global overrides** or
> `!important`, **stop** and refactor the owning layout structure before continuing.

Signs you hit the stop condition:

- Adding rules at the **bottom** of a 500+ line global file "to override Starlight / theme defaults"
- Same selector block edited for the third time in one session
- Fixing desktop by adding `@media (min-width: …)` that unintentionally changes tablet
- New `!important` without a documented escape hatch

### 5. No patch shortcuts

| Don't | Do instead |
|---|---|
| Broad `body .foo` / `html .bar` descendant chains | Scope to surface root (`.docs-layout .foo`) |
| `!important` to win specificity wars | Flatten selectors; split ownership; raise specificity at source |
| `position: sticky` on shell sidebar / docs pane | Viewport-lock flex, or `fixed` + main offset |
| `min-height: 100vh` on shell without scroll contract | `height: 100dvh`, scroll `.content-well` only (`app-shell.md` §8) |
| Sticky header **and** viewport shell that already pins header | Header outside scroll region — layout, not sticky |

## Layout invariants (assert after every layout change)

These catch exact failures screenshots sometimes miss:

| Invariant | How to check |
|---|---|
| Main content starts directly under chrome | `content-well` (or main) `.y` ≈ header height, not hundreds of px |
| Shell columns align at top | `.sidebar` and `.main-area` share the same `.y` (± few px) |
| Document does not scroll in app shells | `window.scrollY === 0`; `body { overflow: hidden }` on desktop |
| Sidebar nav reachable without document scroll | Bottom nav link visible at `scrollY=0` |
| Sticky in-page nav has opaque background | `audit-ui.js` / visual pass while scrolling |
| Active nav indicator aligns with container edge | Measure underline/rail vs border (project-specific) |
| Sidebars don't horizontal-scroll | `scrollWidth <= clientWidth` on nav columns |
| Table header/body weight distinct | thead bold; body normal unless marked |

Playwright example:

```javascript
const topbar = await page.locator('.topbar').boundingBox();
const main = await page.locator('.content-well').boundingBox();
const shellTop = await page.locator('.main-area').boundingBox();
const scrollY = await page.evaluate(() => window.scrollY);

if (shellTop.y > 4) throw new Error('main column pushed down — check sidebar positioning');
if (main.y > topbar.y + topbar.height + 8) throw new Error('content gap under header too large');
if (scrollY > 0) throw new Error('document scroll — shell should be viewport-locked');
```

The harness runs a subset of these in `smoke.mjs` (`layout-viewport-shell`).

## Visual regression checklist

After **any** layout or global style change, capture or compare these **fragile states** (adapt names
to the project):

| Area | Viewports / states |
|---|---|
| Landing | desktop, tablet, mobile |
| Docs | desktop with sidebars, tablet, mobile breadcrumbs/ToC |
| Search | empty, results, long overflow, light/dark |
| Long content | settings/sessions, changelog expanded |
| Chrome | dark/light toggle, utility menus |
| Tables | desktop + mobile horizontal scroll behavior |

Use `ab-harness/scripts/capture.mjs` + `compare.mjs`, or project Playwright tests. **One screenshot
is not enough.**

## Verification gate (before claiming done)

1. Run build / typecheck / lint (project command).
2. Run `audit-ui.js` on changed style files.
3. Run `self-check.js` or project equivalent.
4. Capture screenshots at **desktop, tablet, mobile** for every **touched surface**.
5. Run layout assertions (above) on at least one long-content route.
6. If shared CSS changed, also spot-check **untouched** surfaces (landing, docs, search, changelog).

If a screenshot or metric doesn't match the brief, **keep working** — do not report done.

## Copy into project `AGENTS.md` (optional)

Projects can paste this block so non-skill agents follow the same contract:

```markdown
## Visual / UI engineering rule

Do not fix UI by stacking broad global overrides or breakpoint patches unless no scoped owner exists.

Before editing layout/CSS:
- Identify the owning component, layout, or stylesheet file.
- Prefer scoped styles for that surface over global `body`/`html` selectors.
- Reuse shared tokens for color, spacing, borders, focus, shadows, breakpoints.
- Do not add `!important` without documenting why it is unavoidable.
- Do not change mobile, tablet, and desktop from one broad selector without verifying all three.

Before claiming a UI fix complete:
- Run build/check.
- Capture screenshots at desktop, tablet, and mobile for affected surfaces.
- Verify layout invariants (main content under header, sidebars not pushing layout, no document scroll in app shells).
- If shared CSS changed, verify landing, docs, search, and other major surfaces.

## CSS ownership

New styles go in the narrowest owning file. Global CSS: tokens, resets, typography defaults, shared primitives only.

## UI regression stop condition

If more than two visual fixes in the same area need global overrides, stop and refactor the owning layout before continuing.
```

## Skill cross-references

| Topic | Reference |
|---|---|
| Viewport-locked shell | `app-shell.md` §8 |
| Sticky vs layout-fixed | `sticky-and-scroll.md` Step 2 |
| File structure | `architecture.md` §1, §4 |
| Screenshot harness | `verification.md` |
| Slop to avoid | `anti-patterns.md` |
