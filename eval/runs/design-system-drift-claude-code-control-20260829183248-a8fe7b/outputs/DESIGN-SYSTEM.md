# Design System Extraction

This document records the design tokens extracted from the existing codebase. No visual direction was changed; tokens represent what is currently implemented across CSS files and inline styles.

## Consolidation Overview

The codebase exhibits three years of styling drift across five CSS files (base.css, components.css, legacy.css, utilities.css, vars.css) and scattered inline styles in component files. The tokens below capture what is actually used in production.

## Colors

### Neutral Scale
Extracted from scattered uses across backgrounds, text, and borders. The scale normalizes:
- `#ffffff` as the primary background (0)
- `#f9fafb` as the secondary/highlight background (50)
- Borders at `#e5e7eb` (200) and `#eceff3` (subtle, used in tables)
- Text at `#111827` (primary, 900) and `#1f2937` (secondary, 800)
- Muted text clustered around `#6b7280` (500), with minor variants (`#71717a`, `#737373`, `#6c7280`) that were treated as equivalent

**Why consolidated:** `utilities.css` and `base.css` used slightly different gray values for the same purpose (e.g., muted text). The primary value `#6b7280` appears in base.css, components.css, and Alert hints; variants are treated as implementation drift.

### Primary (Brand)
- Base: `#2563eb` (appears as `#2563ea` in vars.css; both are equivalent in display)
- Hover: `#1d4ed8`
- Light background: `#eff6ff` (alert-info background)
- Light border: `#bfdbfe` (alert-info border)

**Why consolidated:** The brand appears consistently across buttons, links, and focus states. The single-character difference in hex values is a transcription variation, not intentional. Focus outlines, primary buttons, and nav links all use the same base.

### Semantic Status Colors

**Danger:**
- Base: `#dc2626` (primary use in buttons, alerts, inline errors)
- Hover: `#b91c1c` (button-danger:hover)
- Text variant: `#d92626` (DestructiveLink, appears to be the same visually with minor drift)
- Light background: `#fef2f2` (alert-error)
- Light border: `#fecaca` (alert-error)

**Success:**
- Base: `#047857` (used only in .pill-ok)
- Light background: `#ecfdf5` (same element)

**Warning:**
- Base: `#b45309` (alert-warning text)
- Light background: `#fffbeb` (alert-warning)
- Light border: `#fde68a` (alert-warning)

**Why consolidated:** Status colors are used consistently for their semantic purpose (error, success, warning), though they only appear in alerts and pills. No hover states exist for warning or success in the current code.

## Spacing

### Core Scale
Extracted from padding, margins, and gaps:
- `xs: 4px` — found in inline error margin-top
- `sm: 8px` — button and card title padding/margins, calendar cell padding
- `md: 12px` — default nav/button/table padding, most vertical stacks
- `lg: 16px` — larger card padding, h1 margin-bottom, loose stacks
- `xl: 24px` — main layout padding, hr margins

### Logical Stacks
- `stack-tight: 12px` — adjacent elements, minimal breathing room
- `stack: 13px` — default vertical rhythm in paragraphs and utility class
- `stack-loose: 16px` — larger separation in utilities.css

**Why consolidated:** The `13px` value appears both in utilities.css stacks and base.css paragraph margin-bottom; it's the default rhythm. The `12px` tight stack matches nav and button padding, so they share the same token.

## Border Radius

- `radius-sm: 6px` — buttons, alerts, settings panels
- `radius-md: 8px` — cards, HighlightCard
- `radius-full: 999px` — pills

**Why consolidated:** Two distinct radii are in use. The `6px` is applied to interactive elements and smaller components; `8px` appears only on card components. Pills use `999px` for the full pill shape.

## Typography

### Scale
Extracted from element-specific sizes and weights:

- **h1:** 28px, line-height 1.2, margin-bottom 16px
- **h2:** 22px, line-height 1.25, margin-bottom 12px
- **h3:** 18px, line-height 1.3, margin-bottom 12px
- **body (p):** 14px, line-height 1.55, margin-bottom 13px
- **small:** 0.875rem (14px computed), no explicit line-height

All text elements default to `#111827` (base.css), except:
- h3 starts at `#1f2937` (darker gray)
- `<p>` and muted text use `#6b7280`
- Semantic colors override for alerts and status indicators

**Why consolidated:** The font family (Inter, system-ui, sans-serif) is set once in base.css and used everywhere. Size and line-height follow a loose scale without formal multipliers; extracted as-is because they are intentional, not drift.

### Weights
- Regular: `400` (default)
- Semibold: `600` (nav-link-active, table headers)

## Interactive States

### Focus
- Outline: `2px solid #2563eb` (primary color)
- Offset: `2px`

**Applied to:** All focusable elements via `:focus-visible` in base.css.

### Cursor
All interactive elements use `cursor: pointer`.

## Components

Component-level tokens record common padding, sizing, and margins across related elements:

- **Button:** 8px vertical, 16px horizontal padding; 6px radius; 14px font
- **Card:** 8px radius, 16px padding, 12px margin-bottom
- **Alert:** 6px radius, 12px vertical/15px horizontal padding, 14px font, 12px margin-bottom
- **Input:** 14px font size (used in form hints and small text)

**Why extracted:** These tokens document component conventions. They are not used as CSS variables in the current code, but consolidate patterns that should be consistent if components are refactored.

## Drift and Inconsistencies

### Documented
1. **Neutral grays:** Muted text varies between `#6b7280`, `#6c7280`, `#71717a`, `#737373`, `#707680`. All are used for secondary/disabled text and treated as equivalent.
2. **Card border radius:** Components.css cards use `8px`; legacy.css cards use `6px`. Reflected in tokens as separate values.
3. **Padding semantics:** `pad: 15px` and `pad-lg: 16px` in utilities.css mirror card padding (16px) and legacy padding (15px). The 1px difference appears unintentional but is preserved.
4. **Hex notation:** Primary color written as `#2563eb` and `#2563ea` (single-character difference). Treated as one token; the variant is a typo.
5. **Alert padding:** Horizontal padding is 15px (different from standard 16px). Preserved to match current rendering.

### Not Addressed
- `utilities.css` classes (`.muted`, `.subtle`, `.text-sm`, etc.) have no corresponding theme in components.css. They are preserved as utility functions, not semantic tokens.
- Inline styles in components (LinkButton, DestructiveLink, HighlightCard) are not centralized. A future migration should lift these to CSS or use a styling solution.
- The mix() function in Calendar.jsx computes intermediate colors dynamically. Palette endpoints are extracted (base, white, black), but the computed intermediates are not tokenized.

## Migration Strategy

These tokens are extracted but NOT yet applied. The code remains unchanged. A follow-up migration should:

1. Convert `design-tokens.json` to CSS custom properties (e.g., `--color-primary: #2563eb`).
2. Replace hard-coded hex values in CSS files with `var()` references.
3. Lift inline styles in component files to use token-based classes or a styling library.
4. Consolidate duplicate components (card implementations in base, legacy, and HighlightCard).
5. Decide on gray token names and unify muted/subtle/secondary text.

For now, the tokens serve as a snapshot of what exists, enabling future refactoring without guessing at intent.
