# Sticky Elements and Scroll Context

`position: sticky` is useful but easy to misuse. The rule is simple:

**Only make something sticky when (1) you know which element scrolls, and (2) users need that
thing visible while scrolling past other content in the same scroll context.**

If those aren't true, use normal layout (`flex`, `grid`, fixed shell columns) instead.

## Step 1 — Find the scroll container

Before adding `sticky`, answer: *what actually moves when the user scrolls?*

In a **viewport-locked app shell** (`app-shell.md` §8), the answer is almost always
**`.content-well`** (or `<main class="site-main">`) — not `body`, not `.app-shell`, not the
sidebar column (unless the nav list itself is long).

| Scroll context | Typical setup | Who scrolls |
|---|---|---|
| **Document** | `body { overflow: auto }` — avoid in app shells | Whole page (bad for side nav) |
| **App content panel** | `.content-well { flex:1; min-height:0; overflow-y:auto }` | Main column only ✓ |
| **Sidebar nav overflow** | `.sidebar-nav { flex:1; min-height:0; overflow-y:auto }` | Nav links only, if many |
| **Card / panel** | `.scroll-region { overflow-y: auto }` | List inside card |
| **Modal / drawer** | `.modal-body { overflow-y: auto }` | Dialog content |

Sticky sticks within its **nearest scroll ancestor**. If you put `sticky` on an element whose
ancestor doesn't scroll, nothing happens — or it sticks to the viewport in confusing ways.

```
WRONG: sticky settings nav when the whole page scrolls but you thought the sidebar scrolls
RIGHT: sticky settings nav when .content-well scrolls and nav is inside .content-well
```

**Debug checklist:** add `overflow: auto` temporarily to suspected containers; scroll and watch
which box moves.

## Step 2 — Fixed layout vs sticky (don't conflate)

| Need | Use | Not |
|---|---|---|
| Sidebar always visible | `flex` / `grid` column — sidebar doesn't scroll with content | `sticky` on sidebar |
| Top bar always visible while main scrolls | Put top bar **outside** the scrolling `main` / `.content-well` | `sticky` on header inside scrolling main *and* outside |
| Page title visible while long form scrolls | `sticky` on page header row inside scroll container | Duplicate title in chrome |
| Table headers in long table | `sticky` on `thead th` inside table scroll wrapper | Sticky entire table |

**Benchmark example (Acme Console harness):** sidebar + topbar are **layout-fixed**; `.content-well` scrolls. Use only when that shell is locked in direction docs — not as a default.
Only *in-page* elements (settings sub-nav, tab bars, filter rows) use `sticky` inside `.content-well`.

### Sticky sidebar pane trap (docs / Starlight / theme overrides)

`position: sticky` does **not** take the element out of document flow. A full-height `.sidebar`,
`.sidebar-pane`, or docs aside with `sticky` still **reserves its column height** in the layout —
siblings (main content) start **below** that height, which looks like content "pushed way down."

```
WRONG: .sidebar-pane { position: sticky; top: 0 }  /* main still starts after full sidebar height */
RIGHT: viewport-lock flex shell — sidebar column fixed, .content-well scrolls (app-shell.md §8)
RIGHT: .sidebar-pane { position: fixed; … } + main { margin-inline-start: var(--sidebar-width) }
WRONG: keep adding late overrides in global.css to "fix" the offset
```

If you already hit this: stop patching offsets; pick **one** shell contract and delete conflicting
rules. See `regression-guardrails.md`.

## When to sticky what (decision table)

| Element | Sticky? | Condition | `top` offset |
|---|---|---|---|
| **Global header / top bar** | Usually **no** — fix via shell layout outside scroll region | Only if header is *inside* the scrolling region | `0` |
| **Primary sidebar nav** | **No** for column position — layout locks sidebar; **internal scroll** only if many items | `.sidebar-nav { overflow-y: auto }` inside viewport sidebar | — |
| **Secondary nav** (settings categories) | **Yes** | Settings content taller than viewport; desktop side list | `0` (or below sticky page header) |
| **In-page tabs** (project detail) | **Yes** | Tab panels scroll underneath in same container | `0` or `var(--header-height)` if page header also sticky |
| **Page header + actions** | **Sometimes** | Long page, actions must stay reachable | `0` |
| **Filter / search toolbar** | **Yes** | Long result list below in same scroll context | below any sticky row above it |
| **Table `<thead>`** | **Yes** | Table body scrolls inside a region | `0` inside table wrapper |
| **Form Save bar** | **Sometimes** | Form > ~2 viewports; prefer sticky footer bar *or* sticky header with actions | `bottom: 0` for footer bar |
| **Session list header** | **No** | List scrolls inside `.scroll-region-host` — don't sticky page-level chrome over it |
| **Toast / modal** | **Never sticky** | Use `position: fixed` | — |

### When NOT to sticky

- Page fits in one viewport (short settings, empty states).
- Element is already always visible via shell layout.
- Mobile: horizontal tab strip often **scrolls horizontally** instead of sticky side nav.
- Nested scroll: avoid sticky in both outer main **and** inner list unless intentional.
- "Because it looks premium" — every sticky row steals vertical space.

## Stacking and surfaces

Sticky elements need an **opaque background** and a defined **z-index** ladder, or content
shows through while scrolling.

```css
/* Token ladder (add via init-design-tokens.js layout group) */
.settings-nav {
  position: sticky;
  top: 0;
  align-self: flex-start;       /* required in flex rows */
  z-index: var(--z-sticky-subnav);
  background: var(--content-well);
  padding-block: var(--space-2);
}

.tabs--sticky {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky-local);
  background: var(--surface-base);
  border-bottom: 1px solid var(--border-subtle);
}
```

Optional subtle separation when stuck (not a heavy drop shadow):

```css
.is-stuck {
  box-shadow: var(--shadow-sm);
  border-bottom: 1px solid var(--border-subtle);
}
```

Toggle `.is-stuck` with `IntersectionObserver` on a sentinel above the sticky element — only if
you need the edge cue; border alone is often enough.

## Recipes by view type

### Settings (sidebar shell + secondary nav)

```
.content-well scrolls
  └── .settings-layout (flex row)
        ├── .settings-nav     ← sticky top:0, align-self:flex-start
        └── .settings-content ← panels stack, may be tall
```

- Side nav sticks; content scrolls beside it.
- On narrow screens: switch to **horizontal tabs** (`flex-direction: row; flex-wrap`), usually
  **not** sticky — let them scroll horizontally or wrap.

### Project list with search

```
.panel
  ├── .panel-header (search)  ← sticky top:0 when list can grow
  └── .project-list
```

Only sticky the header if the list routinely exceeds the viewport. Otherwise inline search is enough.

### Project detail with tabs

```
.panel
  ├── .detail-header (title, back link)  ← optional sticky if very long
  ├── .tabs                              ← sticky below title
  └── .tab-panel content
```

Users switch tabs without losing context.

### Long form

Prefer in order:

1. **Inline actions** at bottom of short forms.
2. **Sticky action bar** at bottom of scroll container (`position: sticky; bottom: 0`).
3. **Section saves** for multi-card settings (this demo).

Don't use both sticky Save and a sticky header — pick one anchor.

### Data table

Sticky `thead` **inside** the table's scroll wrapper, not on the page:

```css
.table-scroll { overflow: auto; max-height: …; }
.table-scroll thead th {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky-local);
  background: var(--surface-raised);
}
```

## Anti-patterns

| Mistake | Fix |
|---|---|
| `sticky` on sidebar in a flex shell | Sidebar is already fixed — use layout |
| Sticky without `background` | Content bleeds through while scrolling |
| Sticky in wrong scroll ancestor | Identify `.content-well` vs `body` first |
| Everything sticky | Page feels cramped; sticky loses meaning |
| `top: 0` stack collision | Second row needs `top: var(--header-height)` etc. |
| Sticky + `overflow: hidden` parent | Sticky breaks — fix ancestor overflow |
| Mask/shadow on scroll container | Use host overlays (`visual-mechanics.md` §2), not sticky hacks |

## Agent workflow

1. Draw the scroll container (one box).
2. List what must stay visible while *that box* scrolls.
3. Sticky only those items; use layout for chrome.
4. Set `background`, `z-index`, `align-self: flex-start` in flex layouts.
5. Test: scroll to middle, bottom, and resize to mobile — disable sticky that doesn't help.

See `app-shell.md` (chrome vs content), `shell-patterns.md` (geometry), `visual-mechanics.md`
(overflow cues), `interaction.md` (save feedback on sticky action bars).
