# App Shell: Chrome, Navigation, and Wayfinding

The **app shell** is the persistent frame around your content — header, sidebar, footer, and the
slots they contain. Content views swap inside the shell; the shell itself stays stable.

> **Not prescriptive.** These are mental models and nav-tier rules that apply to *any* layout.
> Match the project's existing shell first. If there is none, **choose** a pattern from
> `shell-patterns.md` (top bar, sidebar, or hybrid) based on density and nav count — don't
> force one canonical layout. The invariant is *tier separation* (primary / secondary / utility),
> not a specific wireframe.

## 1. Mental model: chrome vs content

```
┌─────────────────────────────────────────────────────────┐
│  CHROME (shell) — stable across routes                    │
│  brand · primary nav · utility actions                    │
├──────────┬──────────────────────────────────────────────┤
│ optional │  CONTENT — swaps per view                     │
│ sidebar  │  page title · sections · actions for this task │
│ (nav)    │                                               │
└──────────┴──────────────────────────────────────────────┘
```

- **Chrome** answers: *where am I in the product?* and *how do I get elsewhere?*
- **Content** answers: *what am I doing on this page?*
- Never duplicate the page title in both chrome and content (e.g. "Settings" in the header nav
  **and** "Account settings" as `<h1>` — pick one place for the title; it lives in content).

## 2. Navigation tiers (don't mix their jobs)

| Tier | Purpose | Typical items | Placement |
|---|---|---|---|
| **Primary nav** | Top-level product areas — wayfinding between major views | Dashboard, Projects, Inbox, Reports | Header bar or left sidebar |
| **Secondary nav** | Sub-sections within the current area | Profile, Security, Billing (under Settings) | Left sub-nav, tabs, or in-page anchor list |
| **Utility / meta** | Account-level actions, not "pages" in the product sense | Theme toggle, notifications, help, **user menu** | Header trailing edge (right in LTR) |
| **Page actions** | Actions for *this* view only | Save, Export, Create | Content header row, aligned with page title |

**Sane default:** a list/collection page (`Projects`, `Users`, …) gets a **Create {noun}**
primary button in the content header even if the spec only mentions the route — see
`sane-defaults.md`. Dashboard shortcuts do not replace list-page CTAs.

**Settings and preferences** belong in the **utility tier** (gear icon, avatar menu → Settings),
not as a peer nav item beside Dashboard unless Settings is genuinely a top-level product area.
When the user is already on a settings view, highlight it in secondary nav — don't also repeat it
in the utility cluster as the active destination.

## 3. Shell layouts by product type

**Top bar (common for SaaS, marketing-adjacent tools):**
- Brand leading; primary nav inline after brand or centered; utility cluster trailing.
- Content below, often with a max-width container for readability.
- Best when there are ≤5 primary destinations and density is medium.

**Left sidebar (common for enterprise / developer tools):**
- Persistent vertical nav; brand at top; utility at sidebar foot or header trailing.
- Content fills the remaining width; supports many nav items and nested groups.
- Best for high-density, many modules, frequent context-switching.

**Choose one primary pattern and stick to it** within a product — but the choice is yours. See
`shell-patterns.md` for concrete layouts. Don't put primary nav in the header on one page and a
sidebar on another unless you're intentionally migrating.

## 4. Header anatomy (top-bar shell)

```
[ Brand ]  [ Primary · Nav · Links ]     [ Utility: theme | help | avatar ▾ ]
```

- **Brand** — logo + product name; links to home/dashboard. One click target, not two.
- **Primary nav** — `<nav aria-label="Primary">`; current page gets `aria-current="page"`.
- **Utility cluster** — `<div class="utility-nav">` or `<nav aria-label="Utility">`; icon buttons
  need `aria-label`; avatar menu holds Profile, Settings, Sign out.

Keep header height consistent (one `--header-height` token). When the **main content column**
scrolls (`.content-well { overflow-y: auto }`), keep the top bar **outside** that region — layout
fixes it; don't add redundant `sticky`. When the header must live inside a scrolling region, see
`sticky-and-scroll.md`. Sticky headers need a solid background and `border-subtle` bottom edge —
not a heavy drop shadow unless content scrolls beneath.

## 5. Page content structure

Every view inside the shell should open with a predictable content header:

```
<h1>Page title</h1>          ← one per page; matches document <title> closely
<p class="text-muted">…</p>  ← optional one-line description
[ page-level actions ]       ← only actions that apply to the whole view
```

Section headings use `<h2>`; don't skip levels for size. Long settings flows use secondary nav
(tabs or a vertical list) so users don't hunt.

## 6. Settings & preferences UX

- **Entry:** utility menu or avatar → "Settings" / gear icon. Universal convention (Jakob's Law).
- **Inside settings:** secondary nav for categories (Profile, Security, Notifications, Billing).
  The `<h1>` is "Settings" or the category name — not repeated in the global header.
- **Save patterns:** per-section Save (like this demo) or a sticky save bar for long forms —
  but always show save feedback (see `interaction.md`). Don't silently persist without status.
  Use sticky save/footer bars only when the form exceeds ~2 viewports (`sticky-and-scroll.md`).
- **Preferences vs settings:** preferences = how the app behaves for you (theme, locale,
  notifications); settings = account/team configuration. Group accordingly; don't dump both in
  one undifferentiated list.

## 8. Viewport-aware shell (lock chrome, scroll content only)

The shell must **fit the viewport**. Users should never scroll the **document** to reach sidebar
nav or the utility header — only **page content** scrolls (and only the nav column scrolls if
you have dozens of items).

### Mental model

```
┌─ viewport (100dvh) ─────────────────────────────────────┐
│ ┌sidebar─┐ ┌─ main column ────────────────────────────┐ │
│ │ brand  │ │ top bar (fixed height)                   │ │
│ │ nav    │ │ ┌ content-well ───────────────────────┐ │ │
│ │ (scroll│ │ │ page scrolls HERE only               │ │ │
│ │  only  │ │ │                                      │ │ │
│ │  if    │ │ └──────────────────────────────────────┘ │ │
│ │  long) │ └──────────────────────────────────────────┘ │
│ └────────┘                                               │
└──────────────────────────────────────────────────────────┘
         ↑ document/body does NOT scroll
```

### Required CSS pattern

```css
html { height: 100%; }

body {
  margin: 0;
  height: 100%;
  overflow: hidden;              /* kill document scroll */
}

.app-shell {
  display: flex;
  height: 100dvh;               /* or 100% — not min-height alone */
  min-height: 0;
  overflow: hidden;
}

.sidebar {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  overflow: hidden;             /* sidebar column locked to viewport */
}

.sidebar-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;             /* nav scrolls internally if many items */
  overscroll-behavior: contain;
}

.sidebar-foot {
  flex-shrink: 0;               /* user chip / settings entry stays visible */
}

.shell-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.content-well {
  flex: 1;
  min-height: 0;                /* critical — without this, flex child won't shrink */
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

**Why `min-height: 0`:** flex children default to `min-height: auto`, which prevents them from
shrinking below content size — breaking isolated scroll.

**Why not `min-height: 100vh` on `.app-shell`:** the shell grows with content and the whole
page scrolls, pushing sidebar links off-screen.

### Top-bar shell variant

```css
body { display: flex; flex-direction: column; height: 100dvh; overflow: hidden; }
.app-header { flex-shrink: 0; }   /* not position:sticky — layout holds it */
.site-main { flex: 1; min-height: 0; overflow-y: auto; }
```

### Mobile

On narrow viewports you may relax to document scroll **or** keep viewport lock with a collapsed
header + drawer. If you stack sidebar horizontally, `overflow: hidden` on `body` often fights
touch scrolling — switch to `min-height: 100dvh` + let only `.content-well` scroll, or use a
drawer overlay for nav.

**Default:** stack multi-column grids, wrap page toolbars, verify **390px** — no horizontal
overflow. Full patterns: `responsive-design.md`.

See `sticky-and-scroll.md` for what to sticky *inside* `.content-well`.

## 9. Checklist before shipping a shell

- [ ] Shell is defined once; views compose into a content slot
- [ ] Primary / secondary / utility nav tiers are not conflated
- [ ] Page `<h1>` lives in content, not duplicated in chrome
- [ ] Current location is obvious (`aria-current`, active styles)
- [ ] Utility actions (theme, profile, settings) sit in the trailing cluster
- [ ] Header height and nav spacing use tokens; all header buttons share one size tier
- [ ] Skip link targets `#main`; one `<main>` per page
- [ ] **Viewport lock:** `body { overflow: hidden }`, shell `height: 100dvh`, only `.content-well` (and optional `.sidebar-nav`) scrolls — desktop; mobile plan in `responsive-design.md`
- [ ] **Responsive:** primary routes pass 390px overflow check; nav + primary CTA reachable
- [ ] Sidebar footer / utility entry visible without document scroll

See `shell-patterns.md` for layout sketches; `architecture.md` for file structure and composition;
`interaction.md` for navigation behavior and `resources.md` (Material, GOV.UK, Apple HIG) for
platform-specific patterns.
