# Design principles

## Direction before decoration

Lock `design-direction.md` from the interview before styling anything:
mood (2-3 adjectives the human chose), accent color, neutral temperature,
type scale, density. Every later visual decision cites this file.

## Tokens

All color flows through `design-tokens.json`. Required: `text-main`,
`surface-base`. Recommended: `text-muted`, `surface-raised`, `accent`,
`accent-contrast`, `border`, plus status colors (`success`, `warning`,
`danger`).

- `text-main` and `text-muted` must clear **4.5:1** on `surface-base`
  (`check-frontend` verifies this — F-tokens-contrast).
- No hex values in component styles; reference tokens.
- Dark mode is a second token set, not per-component overrides.

## Laws that survive taste

1. **One accent.** A second accent is a hierarchy failure, not a palette.
2. **Type scale is a scale** — 4-6 sizes on a ratio, not per-surface ad-hoc
   values.
3. **Spacing on a grid** (4 or 8px). Alignment is the cheapest polish.
4. **Interactive states exist**: hover, focus-visible, active, disabled.
   A button without a visible focus state is unfinished, not minimal.
5. **Density matches the job** — data tools run tight, marketing runs airy;
   the direction doc says which this is.

## Responsive

A layout is not done at one width. Default assumption unless the direction
doc says otherwise: mobile-first, single primary breakpoint around 768px
(stacked → multi-column), a second around 1280px for wide desktop layouts
that would otherwise over-stretch line length.

1. **No fixed pixel widths on containers that hold text or that a viewport
   can be narrower than.** Use relative units and `max-width`, not a fixed
   `px` container that causes horizontal scroll.
2. **Touch targets are at least 44×44px** on any layout that can be viewed
   on a touchscreen — a link-sized-for-mouse click target is a tap failure
   on mobile.
3. **Content reflows, it doesn't just shrink.** A three-column dashboard
   becomes stacked cards on mobile, not the same three columns squeezed
   into 375px.
4. **Test the primary job's narrowest width**, not just the design mock's
   width. If the walkthrough doesn't say which viewport it was verified at,
   assume it wasn't.

## Accessibility

Beyond focus-visible (law 4 above):

1. **Icon-only controls have an accessible name** (`aria-label` or
   equivalent) — a trash-can icon with no label is unusable for a screen
   reader, and untestable by check-frontend's icon check, which only knows
   icon *packages* exist, not whether any given icon is labeled.
2. **Status is never color-only.** A red dot for "error" needs an icon,
   text, or pattern alongside it — color-blind users and anyone on a
   grayscale/low-contrast display lose color-only signals first.
3. **Images that carry meaning get real alt text**; images that are purely
   decorative get an empty `alt=""`, not a missing attribute (which forces
   a screen reader to guess from the filename).
4. **Motion respects `prefers-reduced-motion`.** Any animation longer than
   a state-change transition (parallax, auto-playing carousels, scroll-tied
   effects) gets a reduced/disabled variant.

## Anti-patterns

Gradient-on-everything, three font families, shadows as decoration rather
than elevation, gray text on gray surfaces below contrast, icon sets mixed
mid-screen, "AI slop chrome" (glassmorphism + purple gradient + emoji
headings nobody asked for).
