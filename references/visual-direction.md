# Visual Direction Lock

Use this in **Phase 2.5** before writing component CSS on **page + app** tiers. The goal is
deliberate, visible differentiation — not a stock template in any direction (admin, marketing, or generic).

**Prerequisite:** `discovery.md` — register and archetype must be chosen (by user or brief), not assumed.

Write the five decisions below (in your response to the user, or as `design-direction.md`
in the project root). **Do not start Phase 3 layout/CSS until these are committed** (page+ tiers).

## The five decisions

### 1. Archetype + personality (one sentence)
Name the archetype from `design-systems.md` and add a personality note.

> Example (enterprise): *Enterprise / tools — dense dark chrome, light content well, monospace for session metadata.*
> Example (consumer): *Consumer / friendly — light chrome, airy spacing, rounded surfaces, single strong CTA.*
> Example (editorial): *Editorial / brand — display type-led hero, generous measure, minimal chrome.*

### 2. Type pairing
Use the fonts emitted in `design-tokens.json` → `meta.fontsUrl` + `type.font-sans` /
`type.font-mono` (and `type.font-display` for editorial). **Do not substitute system-ui**
unless extending an existing project that already uses it.

Include the Google Fonts `<link>` in HTML, or the equivalent loader for the stack.

### 3. Surface strategy
How chrome and content separate:

| Token | Role |
|---|---|
| `chrome-bg` | Sidebar / top bar background |
| `chrome-text` / `chrome-text-muted` | Nav labels on chrome |
| `content-well` | Main content area background (distinct from chrome) |
| `surface-base` / `surface-raised` | Cards, inputs, lists inside the well |

State which surfaces are **flat**, **layered** (shadow), or **bordered**.

### 4. Accent placement
Where brand color appears — pick at least two, not only buttons:

- Chrome (active nav, logo mark)
- Primary actions
- Empty-state icon wash (`accent-subtle`)
- Focus ring / active tab indicator

Avoid accent on everything; avoid accent nowhere except one button.

### 5. One deliberate “not generic” move
Pick **one** visible craft choice and execute it consistently:

- Monospace + tabular nums for metrics / session rows
- Strong page title scale (`text-2xl` + tight leading)
- Tinted empty-state panel on `accent-subtle`
- Section headers with `tracking-label` uppercase eyebrows
- Asymmetric content width (narrow form, full-width list)

If the page could pass as a stock admin template, change type, chrome, or this move.

## Archetype defaults (from `init-design-tokens.js`)

| Archetype | Chrome | Fonts | Content well |
|---|---|---|---|
| **Enterprise** | Dark chrome, light well | IBM Plex Sans + Plex Mono | Cool gray well, white cards |
| **Consumer** | Light tinted chrome | Plus Jakarta Sans + JetBrains Mono | White well, soft radius |
| **Editorial** | Warm paper chrome | Fraunces display + Source Sans 3 | Warm base, generous space |

These are **starting points**. Override in the direction lock only with a stated reason.

## After building

Run Phase 4b differentiation checklist in `SKILL.md`. If `audit-generic.js` reports
high generic score, iterate on type, chrome split, or the deliberate move — not more
border-radius tweaks.
