# Responsive Web Design

Generated front-ends must work on **phone, tablet, and desktop** unless the user explicitly
scopes to one form factor (e.g. kiosk-only). Responsiveness is a **universal invariant** (`sane-defaults.md` Layer A) — independent of product register.

> Desktop-only CSS is a defect for typical web apps — same tier as missing focus styles.

## Mental model

1. **Mobile-first** — base styles for narrow viewports; enhance with `min-width` (or container queries).
2. **Fluid over fixed** — `minmax`, `clamp`, `%`, `fr` before magic breakpoint piles.
3. **No horizontal trap** — `document.documentElement.scrollWidth` must not exceed viewport width.
4. **Touch-ready** — targets ≥44×44px; no hover-only affordances (`visual-mechanics.md`).
5. **Verify three widths** — desktop (≥1280), tablet (~768), mobile (~390) before ship.

## Sane defaults (when spec is silent)

| Area | Default |
|---|---|
| **Viewport meta** | `<meta name="viewport" content="width=device-width, initial-scale=1.0">` — never disable zoom |
| **App shell** | Collapse sidebar → horizontal nav or drawer under ~768px; stack stat grids to 1 column |
| **Page headers** | Wrap toolbar actions; search + primary CTA stack on narrow screens |
| **Tables / wide content** | `overflow-x: auto` on a wrapper — not `width: 1200px` on `body` |
| **Typography** | `clamp()` or fluid scale; body ≥16px (`typography.md`) |
| **Full-height layouts** | `100dvh` not `100vh` on mobile (`architecture.md` §6) |
| **Images** | `max-width: 100%`, `height: auto`, `srcset`/`sizes` when real assets |

See also `sane-defaults.md` — responsiveness is inferred like dark mode and list CTAs.

## Layout patterns

### Grids and cards

```css
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: var(--space-4);
}
```

Single-column fallback at narrow widths is mandatory for multi-column dashboards.

### App shell (sidebar products)

Under `max-width: 768px` (tokenize as `--bp-md` if you have layout tokens):

- Stack shell column-wise **or** use off-canvas drawer — pick one; document in `design-direction.md`.
- Relax `body { overflow: hidden }` if horizontal top-nav + document scroll works better on touch.
- Keep **one** scroll owner — either `.content-well` or document, not both fighting.

See `app-shell.md` §8 Mobile and `shell-patterns.md`.

### Page toolbars

```css
.panel-header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}
.search-field { flex: 1 1 12rem; min-width: 0; }
```

`min-width: 0` on flex children prevents search inputs from forcing horizontal overflow.

### Settings sub-nav

- Desktop: vertical rail beside content.
- Mobile: horizontal tabs or wrapped chips when settings use secondary nav.

## Breakpoints — use sparingly

Prefer **2–3** breakpoints tied to layout breaks, not device brands:

| Token / query | Typical use |
|---|---|
| `max-width: 767px` | Stack shell, single-column grids, full-width panels |
| `min-width: 768px` | Sidebar + multi-column content |
| `min-width: 1024px` | Viewport-locked shell, dense tables |

Use **container queries** (`@container`) when a component must respond to its column, not the viewport.

## Anti-patterns

| Smell | Fix |
|---|---|
| Fixed `width: 1200px` on containers | `max-width` + `margin-inline: auto` + fluid padding |
| `grid-template-columns: repeat(3, 1fr)` with no narrow override | `auto-fit` / `minmax` or `@media` stack |
| Sidebar `width: 220px` + main `min-width: 900px` | Flexible sidebar; allow main to shrink (`min-width: 0`) |
| `100vh` full-screen on mobile | `100dvh`; expect browser chrome resize |
| Hiding overflow with `overflow-x: hidden` on `body` without fixing cause | Fix widths; overflow hidden masks broken layout |
| Desktop-only smoke / screenshots | Capture tablet + mobile (`ab-harness` scenarios) |

## Verification

### Manual / critique

- [ ] Resize 1280 → 768 → 390 — no horizontal scrollbar on any primary route
- [ ] Primary CTA still visible and tappable on mobile
- [ ] Nav reachable without zooming
- [ ] Modals fit viewport; actions not clipped

### Automated

```
node scripts/smoke.mjs --base-url http://127.0.0.1:PORT   # includes layout-responsive-* at mobile
node scripts/capture.mjs --app . --base-url ...            # include mobile scenarios
```

`layout-assert.mjs` → `assertNoHorizontalOverflow` (≤4px tolerance).

`audit-ui.js` flags common non-responsive CSS smells.

### CI / guardrails

`fragile-surfaces.json` should list **mobile** in `viewports` and attach responsive layout checks
to primary routes. `init-ui-guardrails.js` templates ship desktop + tablet + mobile.

## Agent rule

**Phase 3:** write base mobile layout first, then `min-width` enhancements.

**Phase 5:** smoke must pass responsive layout gates; capture at least one mobile screenshot for
touched routes. Report which breakpoints you used in the build summary.

Do not claim responsive unless you verified **390px width** on every changed route.
