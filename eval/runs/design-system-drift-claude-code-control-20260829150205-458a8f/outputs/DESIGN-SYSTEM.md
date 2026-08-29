# Design System Documentation

This document describes the current visual design of the clinic appointment portal as extracted from existing code. No visual direction has been changed—this captures what is already being used throughout the application.

## Overview

The styling system accumulated across three years without formal consolidation, resulting in five CSS files and scattered inline styles. These tokens represent what the application actually does, not an idealized or standardized approach.

## Color System

### Primary Colors
- **#2563eb**: Brand blue used for links, buttons, focus states, and interactive elements
- **#1d4ed8**: Brand hover state (darker blue)

### Text Colors
- **#111827**: Primary text (page headings)
- **#1f2937**: Secondary text (component titles, table cells)
- **#6b7280**: Muted text (hints, secondary content, table headers)

**Color Drift Note**: Three variants of "muted gray" exist due to lack of token reuse:
- `#6b7280` (primary muted, used in base.css and components.css)
- `#6c7280` (typo variant in base.css)
- `#71717a` and `#737373` (redundant definitions in utilities.css)

### Background Colors
- **#ffffff**: Default page and surface background
- **#f9fafb**: Subtle background (used in HighlightCard and legacy table headers)

### Border Colors
Three tiers of borders exist:
- **#e5e7eb**: Default (dividers, card edges, nav borders)
- **#eceff3**: Subtle (table cells)
- **#d1d5db**: Strong (secondary button borders)

### Semantic Colors
Status indicators use dedicated color sets:
- **Success**: #047857 text on #ecfdf5 background (status badges)
- **Danger**: #dc2626 text on #fef2f2 background (error alerts, destructive actions)
  - Hover state: #b91c1c
- **Warning**: #b45309 text on #fffbeb background (warning alerts)
- **Info**: #1d4ed8 text on #eff6ff background (info alerts)

## Spacing

The spacing scale derives from two common values (12px and 16px) with ad hoc variations:

| Token | Size   | Usage |
|-------|--------|-------|
| xs    | 2px    | Pill padding (vertical) |
| sm    | 4px    | InlineError margin-top |
| md    | 8px    | Button padding (vertical), calendar item padding (vertical) |
| lg    | 12px   | Gap, margins, default padding (most components) |
| xl    | 13px   | Paragraph margins, table cell padding (mixed with 12px) |
| 2xl   | 15px   | Legacy padding, ad hoc padding |
| 3xl   | 16px   | Card padding, button padding (horizontal), primary padding |
| 4xl   | 24px   | Typography margins (h1), hr margins |

**Spacing Inconsistency Note**: Vertical and horizontal padding mix different values (e.g., 8px vertical / 16px horizontal for buttons). No clear distinction between margin and padding uses.

## Border Radius

- **6px**: Default for buttons, alerts, input-like components, settings panels
- **8px**: Cards and card-like containers (HighlightCard)
- **999px**: Pill-shaped elements (badges, status pills)

## Typography

### Font Family
```
Inter, system-ui, sans-serif
```

### Scale
| Level | Size    | Usage |
|-------|---------|-------|
| xs    | 12px    | Badge text |
| sm    | 0.875rem | Small text, field hints, card metadata |
| base  | 14px    | Default body, button text, table cells, nav links |
| lg    | 18px    | h3 headings |
| xl    | 22px    | h2 headings |
| 2xl   | 28px    | h1 headings |

### Font Weight
- **400 (normal)**: Default body text
- **600 (semibold)**: Active navigation links, table headers

### Line Heights
- **1.2**: h1 headings
- **1.25**: h2 headings
- **1.3**: h3 headings
- **1.55**: Body paragraphs

## Focus & Accessibility

- **Focus Outline**: 2px solid #2563eb
- **Outline Offset**: 2px

The `:focus-visible` pseudo-class applies to all interactive elements by default via base.css.

## Component Patterns

### Buttons
- **Base**: 14px, 8px vertical / 16px horizontal padding, 6px radius
- **Primary**: #2563eb bg, white text
- **Secondary**: white bg, #374151 text, #d1d5db border
- **Danger**: #dc2626 bg, white text

**One-off Variants**: LinkButton and DestructiveLink use inline styles, duplicating color values.

### Cards
- **Base**: white bg, #e5e7eb border, 8px radius, 16px padding
- **Highlight**: #f9fafb bg (used for dashboard emphasis)
- **Empty State**: Centered, gray text

### Alerts
- **Base**: 12px/15px padding, 6px radius, 14px text
- **Error/Danger**: #fef2f2 bg, #d92626 text, #fecaca border
- **Warning**: #fffbeb bg, #b45309 text, #fde68a border
- **Info**: #eff6ff bg, #1d4ed8 text, #bfdbfe border

**One-off Variants**: InlineError and FieldHint use inline styles for lightweight form feedback.

### Tables
- Headers: 12px padding, #707680 text, #e5e7eb border, 600 weight
- Cells: 13px/12px mixed padding, #1f2937 text, #eceff3 border

### Navigation
- **Base**: white bg, #e5e7eb bottom border, 12px/24px padding
- **Links**: 14px, #6b7280 text
- **Active**: #2563eb text, 600 weight

### Calendar (Appointment Grid)
Density-based shading computed dynamically from the brand color (#2563eb):
- Grid lines: `mix(white, #111827, 0.08)` and `mix(white, #111827, 0.14)`
- Current time indicator: #2563eb
- Slot background: interpolated from white to brand (based on load)
- Slot border: interpolated to darkened brand or lightened brand (based on load > 0.8)

## File Organization

| File | Purpose | Status |
|------|---------|--------|
| `vars.css` | 2024 rebrand attempt; only adopted by settings screen | Incomplete |
| `base.css` | Foundational typography and base element styles | Active |
| `components.css` | Main component classes (btn, card, alert, nav, table) | Active |
| `utilities.css` | Ad hoc spacing and text utilities | Active (inconsistent) |
| `legacy.css` | Original stylesheet; still used by admin screens not ported to components.css | Active |
| Component inline styles | One-offs for LinkButton, DestructiveLink, HighlightCard, InlineError, FieldHint, Calendar | Active |

## Key Consolidations

### Color Unification
- Extracted 15+ hex values scattered across files into a single color palette
- Identified 4 redundant gray values (#6b7280, #6c7280, #71717a, #737373) that should map to one token
- Documented semantic color use (success, danger, warning, info) vs. literal hex in components

### Spacing Scale
- Normalized 8 distinct spacing values (2px, 4px, 8px, 12px, 13px, 15px, 16px, 24px) into a labeled scale
- Noted inconsistent use of vertical vs. horizontal padding in button/component definitions

### Typography Standardization
- Consolidated font sizes across 5 files into a single scale (12px – 28px)
- Identified line-height use cases per heading level and body text
- Standardized font-weight usage (normal and semibold only)

### Component Variance
- Buttons: CSS classes in components.css + inline-styled LinkButton/DestructiveLink duplicating colors
- Cards: CSS-based Card component + inline-styled HighlightCard for dashboard
- Alerts: CSS-based Alert component + inline-styled InlineError/FieldHint for forms
- Calendar: Fully dynamic, computing colors from base brand via linear interpolation

## Why Three Years of Drift?

1. **Multiple Stylesheets**: Each new screen or refactor added to a different file (vars.css, legacy.css, utilities.css) rather than consolidating.
2. **Incomplete Rebrand**: vars.css started a unified color system in 2024 but was never fully adopted or removed.
3. **Inline Styles for "One-Offs"**: Component variants that deviated from CSS classes (LinkButton, HighlightCard) used hardcoded inline styles, avoiding reuse.
4. **No Token Reuse**: Colors and spacing repeated as literals throughout code, making drift accumulate across ad hoc additions.

## Migration Next Steps (Out of Scope)

The design-tokens.json is ready for consumption by:
- CSS custom properties (`:root` vars) in a consolidated stylesheet
- Component library migration (moving inline styles to class-based or CSS-in-JS)
- Build tooling that generates theme files or design token documentation
- Design tools integration (Figma tokens, Storybook, etc.)

**No src/ files have been modified.** This extraction is a snapshot; migration to consume these tokens is separate work.
