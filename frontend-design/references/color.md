# Color: Hierarchy, State, and Dynamics

Color manages attention and cognitive load. Choose colors by role and relative luminance, not by
taste. Map everything to semantic tokens (see `design-systems.md`).

## 1. Chromatic hierarchy and action tiers

Most of an interface should be quiet so the few important things stand out. A useful default split:
roughly 80% neutral structural tones (surfaces, borders, secondary text), with saturated accent
color reserved for action and meaning.

Tier actions instead of treating them as a flat list:

| Tier | Examples | Treatment |
|---|---|---|
| **Primary** | Save, Publish, Submit | Solid accent fill, highest contrast. Limit to one per visual context |
| **Secondary** | Add item, Export, Preview | Outline/ghost or low-saturation tint — clearly interactive, doesn't fight primary |
| **Tertiary** | Cancel, Reset, Close | Neutral text-only; reveal background/border on hover |
| **Destructive** | Delete, Remove | Reserved danger token; require confirmation for irreversible actions |

A dashboard or editor legitimately has several primary actions across different panels — "one
primary action" applies *per local context*, not per page.

## 2. Surfaces and the luminance ladder

Elevation reads through lightness, not just shadow:

- **Dark themes:** higher surfaces are *lighter* than the base (base → raised → overlay get
  progressively lighter). Foreground modals/popovers are the lightest.
- **Light themes:** higher surfaces are *whiter / brighter* than the base, reinforced with shadow.

Define surfaces as a token ladder (`surface-base`, `surface-raised`, `surface-overlay`) so
elevation stays consistent everywhere.

## 3. State shifts via color math

Interactive states should be derived from a base color, not hand-picked. This skill's generator
pre-computes `accent-hover` / `accent-active` tokens, so **prefer the tokens**:

```css
button        { background: var(--accent); }
button:hover  { background: var(--accent-hover); }
button:active { background: var(--accent-active); }
```

The reasoning behind those tokens (apply it when minting new ones):

- Work in **OKLCH** where you can (perceptually uniform — equal lightness steps look equal); HSL is
  an acceptable fallback.
- **Hover:** keep hue/chroma, shift lightness ~±6–12% (direction depends on light/dark theme),
  simulating light hitting the surface.
- **Active/pressed:** push lightness a little further than hover.
- **Disabled:** drop chroma/saturation ~60–80% and move lightness toward the surface so it reads
  as inert.
- Don't jump hue families on interaction (blue → purple) unless it's an intentional brand move.

To compute a state inline instead of minting a token, CSS relative color syntax works:
`oklch(from var(--accent) calc(l - .05) c h)`. Confirm it meets your Baseline target before relying
on it (see `resources.md`); otherwise use the generated token.

## 4. Semantic / status color

Map status to meaning, not raw hue: `success`, `warning`, `danger`, `info`. Never rely on color
*alone* to convey state — pair it with an icon, label, or shape so color-blind users and
grayscale contexts still work. (~8% of men have some color vision deficiency.)

## 5. Gradients are directional, not decoration

A gradient implies a light source and a direction of travel; the eye moves from the high-chroma
stop toward the low-chroma stop.

- Use to anchor a hero/landing block, suggest progression, or add depth to a large surface.
- Avoid behind small body text or dense data — it fragments legibility and wrecks contrast.
- Keep gradient stops within the same hue family for a natural light feel; multi-hue gradients
  read as expressive/brand statements — use deliberately.

## 6. Contrast is a hard requirement

Never approve text/background contrast by eye. Verify it:

```
node scripts/check-contrast.js "#TEXT" "#BACKGROUND"
```

Targets: **WCAG AA** = 4.5:1 for normal text, 3:1 for large text (≥24px, or ≥18.66px bold) and
for meaningful UI/graphic boundaries. **AAA** = 7:1 / 4.5:1. If a pairing fails, choose a
different token and re-check — do not ship failing text.

Test against the **surface the text actually sits on**, not just `surface-base`. Status and error
text on cards often render on `surface-raised`; `init-design-tokens.js` verifies both. When
auditing manually, run `check-contrast.js` against the real pair.
