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

## Anti-patterns

Gradient-on-everything, three font families, shadows as decoration rather
than elevation, gray text on gray surfaces below contrast, icon sets mixed
mid-screen, "AI slop chrome" (glassmorphism + purple gradient + emoji
headings nobody asked for).
