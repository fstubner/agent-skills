# Design System Documentation

## Overview

This document describes the design system consolidated from the existing appointment management application codebase. The app's primary function is managing clinic staff's view of appointments, and the styling reflects three years of organic growth without a formal design system.

## Consolidation Summary

### What Was Extracted

The design tokens were extracted from:
- `src/styles/vars.css` — Incomplete 2024 rebrand attempt (settings screen only)
- `src/styles/base.css` — Global typography and element defaults
- `src/styles/components.css` — Component classes (buttons, cards, alerts, tables, navigation)
- `src/styles/utilities.css` — Spacing and text utilities (added ad hoc, unverified against components.css)
- `src/styles/legacy.css` — Original stylesheet, still imported for unmigrated admin screens
- Inline styles in React components (`Button.jsx`, `Card.jsx`, `Alert.jsx`, `Calendar.jsx`, `App.jsx`)

### Why Consolidation Was Needed

**Color inconsistencies:**
- Primary blue: `#2563ea` (vars.css) vs. `#2563eb` (base.css) — 1-digit difference in 4 out of 5 places
- Muted text: At least 4 variants (`#6b7280`, `#6c7280`, `#6e7681`, `#71717a`) suggesting repeated decisions without reference
- Danger red: `#dc2626` (primary), `#d92626` (inline), `#b91c1c` (hover) — three different reds for one intent
- Border color: `#e5e7eb` (standard) vs. `#eceff3` (subtle) vs. `hsl(220, 13%, 91%)` in legacy code

**Spacing ad hoc-ery:**
- Utilities file notes: "Added ad hoc. Nobody has checked these against components.css."
- Margin values: 12px, 13px, 15px, 16px — all in use, suggesting incremental adjustments rather than a scale
- No distinction between margin and padding conceptually; values just happen to appear where needed

**Structural fragmentation:**
- Four stylesheets imported in specific order, each adding or overriding previous rules
- Inline styles in components bypass the stylesheet system entirely (`LinkButton`, `DestructiveLink`, `Card.HighlightCard`, `InlineError`)
- One-off components created with inline styles rather than unified classes

**Typography scattered:**
- Base styles defined globally (h1/h2/h3/p/small)
- Component-specific overrides (card-title, nav-link, table font-size)
- Inline font sizes in button and link components

## Design Token Categories

### Color Palette

**Primary (Interactive):**
- `#2563eb` — Primary actions, links, active states, focus outlines (most common)
- `#1d4ed8` — Hover and active states (darker blue)

**Text Hierarchy:**
- `#111827` — Primary headings, high contrast text
- `#1f2937` — Secondary headings, card titles, table cells
- `#374151` — Secondary button text (one use)
- `#6b7280` — Body text (primary muted color)
- `#6c7280` — Small text variant (negligible difference from above)
- `#6e7681` — Card meta text (one use, negligible difference)
- `#707680` — Table header text (one use)
- `#71717a` — Utility muted class (one use, darker than #6b7280)
- `#737373` — Utility subtle class (one use, darker still)

**Note on text variants:** At least 4 muted grays in the palette. Consolidation opportunity exists, but exact hex values are preserved to match current rendering.

**Backgrounds:**
- `#ffffff` — Default/card backgrounds
- `#f9fafb` — Secondary backgrounds (highlight card, table header)

**Borders & Dividers:**
- `#e5e7eb` — Primary borders (1px solid)
- `#eceff3` — Subtle dividers (1px solid)
- `#d1d5db` — Secondary button borders
- `hsl(220, 13%, 91%)` — Legacy equivalent of #e5e7eb (3-digit difference in RGB)

**Semantic Colors:**
- **Danger:** `#dc2626` (primary), `#d92626` (inline), `#b91c1c` (hover) — all map to same semantic intent
- **Error Alert:** Background `#fef2f2`, text `#d92626`, border `#fecaca`
- **Warning Alert:** Background `#fffbeb`, text `#b45309`, border `#fde68a`
- **Info Alert:** Background `#eff6ff`, text `#1d4ed8`, border `#bfdbfe`
- **Success:** Text `#047857`, background `#ecfdf5` (pill-ok class)

### Typography

**Font Stack:**
```
Inter, system-ui, sans-serif
```

**Sizes:**
- `28px` — h1
- `22px` — h2
- `18px` — h3, card titles
- `14px` — default paragraph, button, nav, table
- `0.875rem` — small, settings hint, field hint (≈ 14px)

**Line Heights:**
- `1.2` — h1 (tight)
- `1.25` — h2 (snug)
- `1.3` — h3 (normal)
- `1.55` — paragraph (relaxed)

**Margin (Heading Bottom):**
- h1: `16px`
- h2: `12px`
- h3: `12px`
- p: `13px`

### Spacing

**Observed scale (in order of prevalence):**
- `12px` — primary gap, card margin-bottom, nav padding, alert padding-left, table header/cell padding, stack-tight
- `16px` — padding (card, highlight-card), stack-loose, pad-lg
- `24px` — nav padding (horizontal), main margin
- `8px` — button padding (top/bottom), link padding, pile-pill padding-left
- `15px` — padding (legacy-panel, pad), card-empty padding, alert padding-right, pill padding
- `13px` — paragraph margin, stack (default), table cell padding-top
- `2px` — pill padding-top, focus outline-offset shift
- `4px` — focus outline-offset, inline-error margin-top
- `10px` — pill padding-right

**Analysis:** Multiples of 4 (8, 12, 16, 24) form a clear scale; 13px and 15px are outliers, suggesting manual adjustment to achieve specific line heights or visual balance.

### Border Radius

- `6px` — buttons, settings panels, alerts (most common)
- `8px` — cards, highlight cards
- `999px` — pills (circular)

### Components

**Button:**
- Base: `14px`, `8px 16px` padding, `6px` border-radius
- Variants: primary, secondary, danger, link (styled as link), link-destructive

**Card:**
- Background: `#ffffff`
- Border: `1px solid #e5e7eb`
- Padding: `16px`
- Border-radius: `8px`
- Margin-bottom: `12px`
- Special variant: HighlightCard (background `#f9fafb`)

**Alert:**
- Padding: `12px 15px`
- Border-radius: `6px`
- Three variants: error, warning, info (each with background, text, and border colors)

**Table:**
- Font-size: `14px`
- Header: font-weight `600`, padding `12px`, border-bottom `1px solid #e5e7eb`
- Cell: padding `13px 12px`, border-bottom `1px solid #eceff3`

**Navigation:**
- Background: `#ffffff`
- Border-bottom: `1px solid #e5e7eb`
- Padding: `12px 24px`
- Link: `14px`, color `#6b7280`, padding `8px 12px`
- Active link: color `#2563eb`, font-weight `600`

### Utilities

Spacing utilities with specific margin-bottom values:
- `.stack-tight`: `12px`
- `.stack`: `13px` (default)
- `.stack-loose`: `16px`

Text utilities with ad hoc colors:
- `.muted`: `#71717a` (darker than base muted text `#6b7280`)
- `.subtle`: `#737373` (even darker)

Dividers:
- `.divider`: `1px solid #eceff3`
- `.divider-strong`: `1px solid #e5e7eb`

Pills (status indicators):
- `.pill-ok`: green success indicator
- `.pill-late`: red error indicator

### Special Cases

**Calendar Color Palette:**
The `Calendar.jsx` component defines a computed color palette using a `mix()` function to blend colors for density visualization:
- Brand: `#2563eb`
- Grid computed: mix(white, dark text, 8% — very subtle grid line)
- Grid-strong computed: mix(white, dark text, 14% — stronger grid lines)
- Now/Current time: Brand color

**Focus State:**
- Outline: `2px solid #2563eb`
- Outline-offset: `2px`

## Migration Notes

### Inline Styles in Components

The following components use inline styles rather than classes, which should be considered in future refactoring:

- **Button.jsx:**
  - `LinkButton`: Inline style for link appearance
  - `DestructiveLink`: Inline style for destructive link appearance

- **Card.jsx:**
  - `HighlightCard`: Inline style for background, border, border-radius, padding
  - `Card.HighlightCard h3`: Inline style for font-size, color, margin-bottom

- **Alert.jsx:**
  - `InlineError`: Inline style for color and font-size
  - `FieldHint`: Inline style for color and font-size

- **App.jsx:**
  - Main container: Inline style for padding, maxWidth, margin
  - Table row background: Inline `densityBand()` call (computed color based on appointment load)
  - Divider: Inline style for border-color (computed from calendar palette)

### Files Still Using Legacy Styles

`src/styles/legacy.css` is still imported and in use by unmigrated admin screens. It defines:
- `.legacy-panel`, `.legacy-heading`, `.legacy-link`, `.legacy-table`, `.legacy-badge`, `.legacy-note`, `.legacy-warn`, `.legacy-divider`
- Uses `rgb()` and `hsl()` notation inconsistently with the rest of the codebase

### Partially Adopted Rebrand

`src/styles/vars.css` was started in 2024 but only applied to the settings screen. It introduces:
- CSS custom properties (`--brand`, `--brand-hover`, `--text-muted`, `--danger`, `--radius`, `--gap`)
- Settings-specific classes (`.settings-panel`, `.settings-hint`)
- Slightly different primary color (`#2563ea` vs. `#2563eb`)

## Color Accuracy Note

All hex values are recorded as they appear in the source code. Three potential color inconsistencies exist:
1. `#2563ea` vs. `#2563eb` (1-digit difference)
2. `#d92626` (in inline Button.jsx) vs. `#dc2626` (in CSS) for danger red
3. `#6b7280` appearing 3 times vs. `#6c7280`, `#6e7681` for the same semantic purpose

These reflect the codebase as-is; consolidation decisions (which value to unify on) are left to the design system implementation phase.

## Summary

The design system exhibits:
- **Strengths:** Consistent primary color for interactive elements, clear h1/h2/h3 hierarchy, semantic alert color system
- **Gaps:** Multiple muted text colors without clear differentiation, spacing scale with odd values (13px, 15px), component styles mixed between CSS and inline, legacy code still active
- **Drift:** Three years of incremental styling decisions without systematic token management

The extracted `design-tokens.json` preserves every discovered value to serve as a reference for future consolidation work.
