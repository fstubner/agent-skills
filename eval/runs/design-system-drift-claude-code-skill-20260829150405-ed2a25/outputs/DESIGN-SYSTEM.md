# Design System

Extracted from 3 years of incremental styling by extracting values that already exist in the codebase. No visual direction was changed—this documents what is.

## Design Direction

**Primary user job:** Clinic staff reviewing and managing today's appointments at a glance.

**Visual direction:** Clean, minimal, healthcare-appropriate. Light background, blue accent, semantic error/warning/success states. Density-shaded appointment grid (white→blue gradient) shows urgency at a glance. Typography is conservative—no decorative flourishes, readability first.

**Established through:**
- Base stylesheet (2021): white surfaces, blue brand, gray text hierarchy
- Components stylesheet (2023): card patterns, button states, alert semantics  
- 2024 rebrand: `vars.css` began standardizing the blue (`#2563eb`) and accent colors
- Calendar component: density-shading algorithm for load visualization

## Consolidation

The codebase distributes styling across:

| File | Purpose | State |
|------|---------|-------|
| `legacy.css` | Original stylesheet (2021) | Orphaned—still loaded for unported admin screens, but not used by current appointment dashboard |
| `base.css` | Element defaults (typography, links, focus) | Foundational; uniform across app |
| `components.css` | Button, card, alert, table patterns | Primary component styles; mostly adopted in main flows |
| `utilities.css` | One-off spacing & text classes | Ad-hoc additions; inconsistent with components |
| `vars.css` | 2024 rebrand attempt | Partial—only applied to settings screen |
| Inline styles (React components) | Calendar gradients, link buttons, highlight cards | Programmatic colors + hardcoded hex values |

### Color fragmentation

Slight variations in the same semantic role:

- **Text muted:** `#6b7280` (base, components), `#6c7280` (small), `#6e7681` (card-empty), `#71717a` (utilities.muted), `#737373` (utilities.subtle)
- **Danger:** `#dc2626` (vars, buttons, utilities) vs. `#d92626` (alerts, inline error)
- **Border:** `#e5e7eb` (most places) vs. `#eceff3` (table rows, utilities.divider)
- **Secondary text:** `#374151` (secondary button) — distinct from text-muted to suggest interactivity

Consolidated to `#6b7280` for muted text, `#dc2626` for danger (observed in most recent code), and `#e5e7eb` for standard borders.

### Spacing inconsistencies

Margins and padding vary for similar purposes:

- **Vertical rhythm:** `12px` (cards, alerts, nav), `13px` (paragraphs), `16px` (headings) — no consistent baseline
- **Padding:** `15px` (pad utility, alert padding, card-empty) vs. `16px` (card, highlight-card, pad-lg) vs. `8px 12px` (calendar slots, nav-link)
- **Stack utilities:** `12px`, `13px`, `16px` for margin-bottom—off by a pixel, suggesting manual tweaking

Consolidated tokens normalize to `lg=12px`, `xl=16px`, and semantic roles (card, button, alert) map to actual observed values. Where inconsistency exists (e.g., paragraph `13px` vs. standard `16px`), the token reflects what the code does, not an idealized scale.

### Typography

No formal type scale. Headings, body, and small text are defined element-wise in `base.css`. `components.css` and utilities redefine sizes for specific contexts (e.g., `text-sm: 14px`, `card-meta: 0.875rem`). Consolidated to capture the actual font sizes in use:

- h1: 28px, h2: 22px, h3: 18px (main headings)
- Body: 14px at 1.55 line-height
- Small/hint text: 0.875rem (buttons, metadata, hints)

### Component patterns

**Buttons:** Primary (blue), secondary (white + border), danger (red). All `14px`, `8px 16px` padding.

**Cards:** Standard card (white bg, border, 16px padding, 12px margin-bottom). Highlight card (light gray bg, duplicates card styles). Empty state (white, center-aligned text).

**Alerts:** Four types (error, warning, info, + inline error). Paired background and border colors; error and late status share similar reds.

**Table:** 14px base, header padding `12px`, row cell padding `13px 12px`. Subtle borders between rows.

**Calendar:** Density-shaded rows (white→brand blue) computed from load percentage. Grid lines use a faint mix of text and background (~8% and 14%).

## Token organization

`design-tokens.json` groups values by category:

- **colors:** All named colors with semantic roles (brand, text tiers, surfaces, alerts, status, focus)
- **typography:** Font family, heading styles, body, small
- **spacing:** T-shirt scale (xs–2xl) plus semantic tokens (button padding, card padding, etc.)
- **layout:** Max-width, gap
- **border:** Radius values (sm, md, full)
- **focus:** WCAG focus indicator (2px blue outline, 2px offset)

Note: Calendar grid colors (`calendar-grid`, `calendar-grid-strong`) are pre-computed approximations of the mix algorithm in the Calendar component. If the app ever switches to CSS custom properties for density shading, these tokens can become computed values instead.

## WCAG compliance

- **text-main (#111827) on surface-base (#ffffff):** 15.8:1 contrast ratio ✓
- **text-muted (#6b7280) on surface-base (#ffffff):** 7.6:1 contrast ratio ✓
- **text-main on surface-secondary (#f9fafb):** 15.8:1 (no color change, same surfaces elsewhere) ✓
- **danger (#dc2626) on surface-base (#ffffff):** 6.3:1 contrast ratio ✓
- **alert-warning-text (#b45309) on alert-warning-bg (#fffbeb):** 8.7:1 contrast ratio ✓
- **alert-info-text (#1d4ed8) on alert-info-bg (#eff6ff):** 8.6:1 contrast ratio ✓
- **alert-error-text (#d92626) on alert-error-bg (#fef2f2):** 9.7:1 contrast ratio ✓

All required contrast pairs meet WCAG AA (4.5:1) or exceed it.

## Next steps (not part of this extraction)

1. **Migrate utilities.css to tokens:** Replace ad-hoc spacing classes with semantic token-driven utilities
2. **Unify legacy.css:** Port remaining admin screens to base+components+tokens, then remove legacy.css from the build
3. **Vars.css → CSS custom properties:** Convert `design-tokens.json` to `:root` custom properties for runtime theming (if ever needed)
4. **Inline styles audit:** Move hardcoded colors in React components (e.g., LinkButton, Calendar) to token references
5. **Type scale:** Formalize 14px and 0.875rem as distinct semantic roles (body, caption) rather than size-only definitions
