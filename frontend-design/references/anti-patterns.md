# Anti-Patterns: Avoiding Generic, AI-Looking UI

These are the failure modes that make generated UI look generic, feel broken, or fail
accessibility. Scan this list when output "feels off" or before finishing a component. Each fix
points to the rule that explains it.

| Slop (don't) | Do instead | Reference |
|---|---|---|
| Placeholder text used as the label | Visible `<label>`; placeholders are hints, not labels | interaction.md, accessibility.md |
| `outline: none` with no replacement | Keep a visible `:focus-visible` ring | visual-mechanics.md, accessibility.md |
| Emoji as icons | One consistent icon set; `aria-hidden` on decorative | typography.md |
| `<div onclick>` / `<span>` for actions | Native `<button>` / `<a>` | architecture.md, accessibility.md |
| Hardcoded hex or random px (`mt-[13px]`, `#333`) | Color + space tokens | design-systems.md, color.md |
| Hover is the only affordance | Base affordance + `@media (hover: hover)` for hover extras | visual-mechanics.md |
| Everything centered; identical card grid for all content | Hierarchy via size/weight/color; vary layout by content | typography.md, color.md |
| Gradients / glassmorphism everywhere | Gradients are directional and used sparingly | color.md |
| Low-contrast gray-on-gray "aesthetic" text | Verify contrast; muted ≠ invisible | color.md |
| Walls of equal-weight text | Establish a clear scan hierarchy | typography.md |
| Everything animated; `transition: all …linear` | Motion explains state; 100–200ms ease-out; animate transform/opacity only | visual-mechanics.md |
| No empty / error / loading states | Design all states, with recovery | interaction.md |
| Tiny or densely packed tap targets | ≥ ~44px targets with adequate spacing | accessibility.md |
| Reinventing dropdowns/modals/tabs (buggy a11y) | Native elements, or APG / Inclusive Components patterns | resources.md |
| Components setting their own outer margins | Spacing comes from the parent layout primitive (`gap`) | architecture.md |
| Confirm dialog for every action | Prefer undo; confirm only the irreversible | interaction.md |
| Permanent scroll-edge fade (mask always on) | Toggle `data-overflow` from scroll position; no fade when at end | visual-mechanics.md |
| `mask-image` on the scroll container | Use `.scroll-region-host` overlays; stop fades at `right: var(--scrollbar-gutter)` | visual-mechanics.md §2 |
| Colored dots as status/error indicators | Icon + text + tinted banner; field errors inline with icon | interaction.md |
| `display: flex/grid` on `[hidden]` elements | Use `:not([hidden])` so the hidden attribute works | accessibility.md |
| Settings duplicated in header nav and page title | Settings in utility tier; `<h1>` in content; secondary nav for categories | app-shell.md |
| Mixed button sizes in the same toolbar | One size tier per context; icon buttons same `min-height` as text buttons | app-shell.md, accessibility.md |
| Status colors verified only on base surface | Also verify on `surface-raised` where status text actually renders | color.md, init-design-tokens.js |
| `system-ui` + `#2563eb` + flat white cards everywhere | Archetype fonts from `meta.fontsUrl`; `chrome-bg` ≠ `content-well`; see `visual-direction.md` | visual-direction.md, design-systems.md |
| Chrome same luminance as content (one flat plane) | Dark or tinted `chrome-bg` on `content-well`; nav uses `chrome-text` tokens | visual-direction.md, color.md |
| Save success = fading green text only | Status banner: icon + text on tinted surface (`data-tone`) | interaction.md |
| Dark mode = invert grays | Separate dark token contract; re-run `check-tokens-contrast.js` | SKILL.md Phase 2 |
| Identical card stack for every section | Vary layout: form card, tinted empty state, scroll list without card wrapper | architecture.md, visual-direction.md |
| Page title same weight/size as section heads | Three hierarchy levels: `text-2xl` page / `text-lg` section / `text-sm` meta | typography.md |
| Accent only on one primary button | Accent on active nav, focus ring, empty-state wash (`accent-subtle`) — ≥2 roles | visual-direction.md |
| `position: sticky` on shell sidebar | Sidebar stays visible via flex/grid layout — not sticky | sticky-and-scroll.md |
| `position: sticky` on full-height docs/sidebar **pane** | Sticky keeps full height in flow — pushes main down; use viewport lock or `fixed` + main offset | regression-guardrails.md |
| Sticky without opaque background | Set `background` to the surface behind it (`content-well`, `surface-base`) | sticky-and-scroll.md |
| Sticky filter/header on short lists | Sticky only when content actually scrolls past it | sticky-and-scroll.md |
| `overflow: hidden` on sticky ancestor | Sticky breaks — move scroll to intended container | sticky-and-scroll.md |
| `min-height: 100vh` on shell — whole page scrolls | `height: 100dvh` + `body { overflow: hidden }`; scroll `.content-well` only | app-shell.md §8 |
| Scrolling document to reach sidebar nav | Viewport-lock shell; `.sidebar-nav` scrolls internally if long | app-shell.md §8 |
| Reactive global CSS patches / override piles | Identify surface owner; refactor after 2nd global fix; scope selectors | regression-guardrails.md |
| `!important` to win specificity wars | Flatten ownership; fix at source; document if unavoidable | regression-guardrails.md |
| One mobile fix via broad selector | Scope to surface; verify desktop + tablet + mobile | regression-guardrails.md, responsive-design.md |
| Multi-column grid with no narrow override | Stack or `auto-fit`/`minmax` at mobile | responsive-design.md |
| `width: Npx` on page containers without `max-width: 100%` | Fluid shell; horizontal scroll on wrapper only | responsive-design.md |
| `btn-ghost` chrome colors in content area | Scope ghost styles: `chrome-text-muted` on sidebar only; content uses `text-muted` | color.md, app-shell.md |
| Accent text on `accent-subtle` background | Active nav: `text-main` + accent border/rail — verify with axe | color.md, axe-check.mjs |

When you catch one, fix it and check whether the same mistake repeats elsewhere — slop tends to
cluster. A clean pass here is necessary, not sufficient: it removes the obvious tells, but good
design still requires the judgment in the other references.

After anti-patterns, run `audit-generic.js` on full pages to catch generic SaaS tells that pass
the other audits.
