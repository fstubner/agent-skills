# Typography: Semiotics and Hierarchy

Type is the backbone of communication on the web. Weight, style, size, and spacing are signifiers
that tell the reader how to interpret the voice of the text — not just cosmetic dials.

## 1. Variants carry meaning

Match the variant to the intent of the copy:

- **Weight** establishes hierarchy. Use a heavier weight (600–700) for headings/emphasis and a
  regular weight (400–450) for body. Don't simulate hierarchy with size alone.
- **Italic** is not "slanted text." It marks a shift in voice: titles of works, foreign terms,
  technical citations, editorial asides, or implied internal thought. Don't use it for generic
  emphasis (use weight) or for long passages (it hurts readability).
- **ALL CAPS / small caps** suit short labels, eyebrows, and category tags — never running prose.
- **Monospace** signals code, identifiers, and tabular numeric data where column alignment matters.

## 2. Scale and rhythm

- Use a consistent **modular type scale** (e.g. a 1.2–1.25 ratio) and store steps as tokens
  (`text-xs … text-2xl`). Avoid arbitrary one-off font sizes.
- **Line height (leading):** large display text wants tight leading (1.1–1.25) to read as one
  unit; body/long-form prose wants looser leading (1.5–1.65) to avoid line-skipping.
- **Letter spacing (tracking):** add slight positive tracking to small uppercase labels
  (≈0.02–0.06em); leave body text at the font's default; leave monospace untouched so columns
  align.
- **Measure (line length):** keep body copy to ~45–75 characters per line for comfortable reading.
  Constrain with `max-width` (e.g. `60ch`), not fixed pixels.

## 3. Hierarchy without clutter

Establish clear levels with as few signals as needed: size + weight + color (muted vs. main) are
usually enough. Each additional differentiator (italic + color + underline + size) adds noise.
A reader should locate the title, section heads, and body at a glance.

- Body: main text color, regular weight.
- Secondary/metadata: muted text token, often smaller.
- Headings: larger step + heavier weight; color shift optional.

## 4. Match the archetype

Pair typographic choices with the project's audience (see `design-systems.md`). On greenfield
pages, use the font stacks from `init-design-tokens.js` (`meta.fontsUrl`) — not system-ui alone.

- **Enterprise / tools:** IBM Plex Sans + Plex Mono; tight scale; mono for metrics, sessions, IDs.
- **Consumer / SaaS:** Plus Jakarta Sans + JetBrains Mono; comfortable sizes; clear weight contrast.
- **Editorial / brand:** Fraunces display + Source Sans 3; dramatic scale leaps and generous spacing.

## 5. Practical defaults

- On greenfield pages, load `meta.fontsUrl` from the token contract. Use `font-display: swap`.
  System-ui is a fallback tail in the stack, not the primary face.
- Set base body size ≥16px so mobile browsers don't zoom inputs and reading stays comfortable.
- Use relative units (`rem`/`em`, `ch`) for type and measure so user font-size preferences are
  respected.
- Never sacrifice contrast for style — verify per `color.md`.

## 6. Icons

Icons are pictographic language, not decoration — treat them with the same intent as type.

- Use **one consistent icon set** (inline SVG or a single library); don't mix styles, and never
  use emoji as UI icons (they render differently per platform and add screen-reader noise).
- **Size relative to context:**
  - Inline with text / buttons: `1.25em` square, `flex-shrink: 0`, optically aligned.
  - Empty-state / feature illustrations: `2–2.5rem` — visibly larger, still token-derived.
  - Brand mark in header: `1.5rem`, paired with wordmark in one link target.
- **Decorative icon →** `aria-hidden="true"`. **Icon-only control →** needs `aria-label` on the
  `<button>`/`<a>`, not on the SVG (see `accessibility.md`).
- Pair icon + text for important actions; reserve icon-only for universally understood actions
  (close, search, settings gear) — and still label them.
- Use meaningful signifiers consistently: chevron = expand/disclosure, arrow = navigation,
  gear = settings, check-circle = success, alert-circle = error.
- **Never use a colored dot** (`::before { border-radius: 50% }`) as a status indicator — use a
  proper icon shape (see `interaction.md` §3).
