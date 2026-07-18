# Design Systems: Archetypes and the Token Contract

A design system has two parts: the **decision** (what kind of product is this, who is it for) and
the **output** (a token contract that encodes that decision). Get the decision right first, then
encode it once and reuse it everywhere.

## 1. Choose the archetype

Density and personality must match the audience and purpose. Determine the archetype from the
README, package description, existing design, or by asking the user. The visual *physics*
(elevation, contrast, focus, motion) stay constant; spacing, radius, and personality change.

| Archetype | Context | Density | Spacing baseline | Radius | Personality |
|---|---|---|---|---|---|
| **Enterprise / tools** | Dashboards, IDEs, data-dense panels, admin | High | 4px grid | Sharp (2–4px) | Sterile, structured, monospace for data |
| **Consumer / SaaS** | Storefronts, social, mainstream SaaS | Medium | 8px grid | Soft (8–12px) | Approachable, legible, comfortable targets (≥44px) |
| **Editorial / brand** | Portfolios, marketing, immersive | Low | Fluid / generous | Varies | Expressive; whitespace and scale contrast as tools |

If the audience is genuinely ambiguous and no system exists, ask before assuming. When you must
proceed without an answer, default to **consumer / medium** and state the assumption.

## 2. The token contract

Tokens are semantic (named by role), not literal (named by value). Components reference roles, so
the same component code works across projects and themes.

```
Brittle:      box-shadow: 0 4px 10px rgba(0,0,0,.1);
Token-driven: box-shadow: var(--shadow-md);
```

Generate a starting contract with:

```
node scripts/init-design-tokens.js --archetype <enterprise|consumer|editorial> --brand "#RRGGBB"
```

It computes accessible neutrals and writes `design-tokens.json`. See
`assets/design-tokens.example.json` for the full shape. Core groups:

- **color** — role-based:
  - chrome: `chrome-bg`, `chrome-text`, `chrome-text-muted`, `chrome-border` (nav shell — must
    contrast with `content-well`; see `visual-direction.md`)
  - content: `content-well` (main panel background behind cards)
  - surfaces: `surface-base`, `surface-raised`, `surface-overlay` (luminance ladder, see `color.md`)
  - washes: `accent-subtle` (empty states, soft highlights)
  - text: `text-main`, `text-muted`, `text-on-accent`
  - lines: `border-subtle`, `border-strong`
  - brand/action: `accent`, `accent-hover`, `accent-active`, `focus-ring`
  - status: `success`, `warning`, `danger`, `info` (mode-appropriate; generator verifies AA on
    **both** `surface-base` and `surface-raised` — status text often sits on cards)
- **space** — a scale on the archetype's baseline (`space-1 … space-8`)
- **radius** — `radius-sm/md/lg/full`
- **shadow** — elevation ladder `shadow-sm/md/lg` (soft, ambient) + `shadow-overflow` (inset/mask)
- **type** — `font-sans`, `font-mono` (+ `font-display` for editorial), scale `text-xs … text-2xl`,
  line-height + tracking tokens. **`init-design-tokens.js` emits archetype-specific web font stacks**
  and `meta.fontsUrl` — load these in HTML; do not default to system-ui on greenfield pages.
- **layout** — `sidebar-width`, `header-height`, `fade-size`, `content-max`, `scrollbar-gutter`,
  z-index ladder (`z-sticky-local`, `z-sticky-subnav`, `z-chrome`, `z-modal`, `z-toast`)
- **motion** — `duration-fast/base/slow`, `ease-standard` (cubic-bezier)
- **meta** — `archetype`, `density`, theme mode, **`fontsUrl`**, `visualNote`

**Format:** this is a deliberately simple flat JSON shape, easy for an agent to author and read. If
the project already uses the **Design Tokens Community Group (DTCG)** format (`$value`/`$type`,
consumed by Figma, Style Dictionary, Tokens Studio), follow that instead — see `resources.md`.

## 3. Consuming tokens per stack

Match the project's styling system — never introduce a second one:

- **Existing design system** (MUI, Chakra, shadcn/ui, Radix themes, Mantine, etc.): if
  `design-profile.json` lists one, **extend its theme** with your semantic roles — don't replace
  the library or rebuild primitives it already provides. Map token values into their theme config;
  apply `app-shell.md` tier rules using their layout/shell components (`shell-patterns.md`).
- **CSS / SCSS:** expose as custom properties on `:root` (`--accent`, `--space-3`, …). Theme/mode
  switches by overriding the same variables under `[data-theme="dark"]`.
- **Tailwind:** map tokens into `theme.extend` or v4 `@theme` (via `tokens-to-css.js`); don't
  hand-write arbitrary values like `mt-[13px]`.
- **CSS-in-JS / component libs:** feed the contract into the theme provider; reference theme keys,
  not literals.

## 4. Defaults when running without setup

If no contract exists and the user declines to generate one, you may proceed using a documented
default set derived from the chosen archetype above — but say so explicitly, keep everything
mapped to named variables (so it's trivially swappable later), and never silently bake literals
into many files.

## 5. Evolving the system

- Extend by adding a token, not by hardcoding a new value in a component.
- Re-theming (e.g. dark IDE → light marketing) should be a token change, not an HTML/structure
  change. If you find yourself editing many components to change a color, the tokens are wrong.
