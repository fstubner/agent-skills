# Shell Patterns: Pick One, Don't Force One

Three common layouts — all valid. **Use what the project already has.** If greenfield, pick based
on nav count and density (see `app-shell.md` §3). Nav tiers (primary / secondary / utility) apply
to every pattern; only the *geometry* changes.

## When to use which

| Pattern | Good fit | Avoid when |
|---|---|---|
| **Top bar** | ≤5 primary destinations, marketing-adjacent SaaS, content-first | Many nested modules, constant context-switching |
| **Sidebar** | Enterprise tools, dashboards, dev tools, 6+ nav items | Simple single-purpose apps, mobile-first consumer flows without a collapse plan |
| **Hybrid** | Sidebar for modules + top bar for search/utility | You can't maintain two nav layers cleanly |

Existing component libraries (MUI Drawer, shadcn sidebar, etc.) — **use them**; map their slots
to the tiers in `app-shell.md` instead of building a bespoke shell from scratch.

---

## Pattern A — Top bar

```
┌────────────────────────────────────────────────────────────┐
│ [Brand]  Dashboard  Projects  …     [theme] [help] [user ▾] │
├────────────────────────────────────────────────────────────┤
│  <main>                                                    │
│    <h1>Page title</h1>                                     │
│    …content…                                               │
│  </main>                                                   │
└────────────────────────────────────────────────────────────┘
```

- Primary nav inline after brand (or centered on marketing sites).
- Utility cluster trailing: theme, notifications, avatar menu → Settings.
- Settings **inside** a view: optional secondary nav as tabs or a vertical list *in content*,
  not a second global header row.

## Pattern B — Sidebar

```
┌──────────┬─────────────────────────────────────────────────┐
│ [Brand]  │  [optional top utility: search · user ▾]        │
│──────────│─────────────────────────────────────────────────│
│ Dash     │  <main>                                         │
│ Projects │    <h1>Page title</h1>                          │
│ Reports  │    …content…                                    │
│──────────│                                                 │
│ Settings │                                                 │
│ [user]   │                                                 │
└──────────┴─────────────────────────────────────────────────┘
```

- Primary nav in the sidebar column.
- Utility at sidebar foot **or** header trailing — pick one convention, stay consistent.
- Collapse to icon rail or drawer on narrow viewports; don't duplicate full nav in header and sidebar.
- **Viewport lock (desktop):** shell `height: 100dvh`, `body { overflow: hidden }`, scroll only
  `.content-well` (and `.sidebar-nav` if the primary list is long). See `app-shell.md` §8.

## Pattern C — Hybrid (sidebar + top bar)

```
┌──────────┬─────────────────────────────────────────────────┐
│ [Brand]  │  [breadcrumb]              [search] [user ▾]    │
│──────────│─────────────────────────────────────────────────│
│ Module A │  <main> …                                       │
│ Module B │                                                 │
└──────────┴─────────────────────────────────────────────────┘
```

- Sidebar = **primary** module switching.
- Top bar = **orientation** (breadcrumb/title) + **utility** — not a second primary nav.
- Common in dense admin UIs; higher implementation cost — only use when the IA needs it.

---

## Settings views (any pattern)

Regardless of shell choice:

1. Enter via utility (gear / avatar menu) unless Settings is a true top-level product area.
2. `<h1>` in `<main>` — "Settings" or the active category name.
3. **Secondary nav** for categories (Profile, Security, Billing) — tabs, side list, or segmented control.
   Side lists: `position: sticky` only when settings content scrolls inside `main` — see
   `sticky-and-scroll.md`.
4. Don't mark the utility gear `aria-current="page"` *and* show a full settings secondary nav —
   the secondary nav carries "where in settings"; the gear is just the entry point.

## Viewport lock (all patterns)

On desktop, the shell should **fit the viewport** — users must not scroll the document to reach
sidebar nav or the global header. Lock layout height (`100dvh`), set `body { overflow: hidden }`,
and scroll only the main content region (`.content-well`, `.site-main`, or `.app-body` for top-bar
apps). Full flex chain: every ancestor of the scroll region needs `min-height: 0`. See
`app-shell.md` §8 and `sticky-and-scroll.md` Step 1.

## Extend, don't replace

If `design-profile.json` reports MUI, Chakra, shadcn, Radix, etc.:

- Use that library's `AppBar`, `Drawer`, `Sidebar`, `Shell` primitives.
- Map your tokens onto their theme provider where possible.
- Apply tier rules and `anti-patterns.md` — the library handles geometry; you handle hierarchy and behavior.
