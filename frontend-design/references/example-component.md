# Worked Example: A Correct Component

One concrete, framework-neutral build that applies the skill end to end. It is illustrative, not
canonical — **adapt the syntax to the project's framework and map `var(--…)` to its token system.**
The value is in the decisions and how each traces back to a reference.

## A primary action button with a loading state

```html
<!-- Native <button>: keyboard, focus, and semantics for free (architecture.md, accessibility.md) -->
<button type="button" class="btn" data-state="idle">Save changes</button>
```

```css
.btn {
  /* Tokens, never literals (design-systems.md) */
  background: var(--accent);
  color: var(--text-on-accent);          /* contrast verified at generation (color.md) */
  padding: var(--space-2) var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font: inherit;
  cursor: pointer;
  /* Motion explains state; tokenized; compositor-only properties (visual-mechanics.md) */
  transition: background-color var(--duration-fast) var(--ease-standard),
              transform var(--duration-fast) var(--ease-standard);
}

/* Interaction matrix: hover lifts, active presses, focus is always visible (visual-mechanics.md) */
@media (hover: hover) {
  .btn:hover { background: var(--accent-hover); }   /* hover extra is pointer-only */
}
.btn:active { background: var(--accent-active); transform: translateY(1px); }
.btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

.btn:disabled { opacity: .6; cursor: not-allowed; }   /* inert, not just dimmed */

/* State driven by a data hook, not a bespoke class (architecture.md, interaction.md) */
.btn[data-state="loading"] { cursor: progress; }

@media (prefers-reduced-motion: reduce) {
  .btn { transition: none; }              /* respect the user (accessibility.md) */
}
```

```js
// Immediate feedback BEFORE the async call (interaction.md, architecture.md §7)
btn.addEventListener('click', async () => {
  btn.dataset.state = 'loading';
  btn.setAttribute('aria-busy', 'true');  // announce to assistive tech (accessibility.md)
  btn.disabled = true;
  try {
    await save();
  } catch {
    btn.dataset.state = 'error';          // recoverable, specific — never a dead end (interaction.md)
  } finally {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (btn.dataset.state !== 'error') btn.dataset.state = 'idle';
  }
});
```

## What makes this correct
- Native element + `data-state` hook — not `<div onclick>` and `.is-loading-v2`.
- Every value is a token; `text-on-accent` on `accent` contrast was verified (color.md).
- Hover is pointer-gated and never the only affordance; focus is always visible.
- The async path gives synchronous feedback and a real error state.

## Status feedback (not colored dots)

```html
<p class="status" role="status" aria-live="polite" data-tone="danger" hidden>
  <svg class="icon" aria-hidden="true">…alert-circle…</svg>
  <span>Couldn’t save changes. Check your connection and try again.</span>
</p>
```

```css
.status { display: inline-flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-md); }
.status[data-tone="danger"] {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
}
```

Icon + text + tinted banner — never `::before { border-radius: 50% }` (interaction.md §3).

Icon + text + tinted banner — never `::before { border-radius: 50% }` (interaction.md §3).

---

## Full page: enterprise settings (chrome split + hierarchy)

Illustrates Phase 2.5 decisions executed end to end. Adapt markup to the project's framework.

### HTML head — load archetype fonts

```html
<link rel="stylesheet" href="tokens.css">
<!-- From design-tokens.json → meta.fontsUrl -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap">
```

### Shell structure

```html
<div class="app-shell">
  <aside class="sidebar" style="background: var(--chrome-bg); color: var(--chrome-text);">
  <!-- primary nav: active link uses accent on chrome (visual-direction.md §4) -->
  </aside>
  <div class="shell-main">
    <header class="top-bar"><!-- utility: theme, help, user --></header>
    <main class="content-well"><!-- NOT surface-base — distinct from chrome -->
      <header class="page-header">
        <p class="eyebrow">Settings</p>
        <h1>Account</h1>
        <p class="text-muted">Manage profile, connections, and sessions.</p>
      </header>
      <div class="settings-layout">
        <nav class="secondary-nav" aria-label="Settings categories">…</nav>
        <div class="stack">…sections…</div>
      </div>
    </main>
  </div>
</div>
```

### Key CSS decisions

```css
/* Viewport lock — shell fits viewport; only content scrolls (app-shell.md §8) */
html, body { height: 100%; }
body { overflow: hidden; }
.app-shell {
  display: flex;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}
.sidebar {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.sidebar-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.shell-main {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.content-well {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* Chrome vs content — must be visibly distinct (visual-direction.md) */
.sidebar {
  width: var(--sidebar-width);
  background: var(--chrome-bg);
  color: var(--chrome-text);
  border-right: 1px solid var(--chrome-border);
}
.content-well {
  background: var(--content-well);
  padding: var(--space-6);
}
.nav-link[aria-current="page"] {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

/* Three hierarchy levels (typography.md) */
.page-header h1 {
  font-family: var(--font-sans);
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: var(--leading-tight);
}
.eyebrow {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
  color: var(--text-muted);
}
.card { background: var(--surface-base); box-shadow: var(--shadow-sm); }

/* Deliberate craft move: mono session metadata (visual-direction.md §5) */
.session-meta {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Empty state on accent-subtle — not a plain white card */
.empty-state {
  background: var(--accent-subtle);
  border: 1px dashed color-mix(in srgb, var(--accent) 30%, transparent);
  border-radius: var(--radius-lg);
  padding: var(--space-7);
}
```

### What makes this visibly better than generic admin
- **Dark chrome / light well** — not one flat white plane.
- **IBM Plex** — not system-ui.
- **Eyebrow + `text-2xl` title + muted subtitle** — three scan levels.
- **Accent on active nav** plus primary buttons — accent in ≥2 roles.
- **Monospace session meta** — one deliberate craft signature.
- **Tinted empty state** on `accent-subtle`.

Run `check-tokens-contrast.js`, `audit-ui.js`, and `audit-generic.js` before done.

### Scroll list with edge fades

```html
<div class="scroll-region-host">
  <div class="scroll-region" tabindex="0" role="region" aria-label="Sessions">
    <ul class="session-list">…</ul>
  </div>
</div>
```

Use host `::before` / `::after` overlays — not `mask-image` on the scroller (overlaps scrollbar).
See `visual-mechanics.md` §2.

### Sticky in a scrolling main column

When `.content-well` scrolls, shell chrome stays fixed via **layout** — not `sticky`. Only
in-page controls stick (`sticky-and-scroll.md`):

```css
.content-well { overflow-y: auto; }

.settings-nav {
  position: sticky;
  top: 0;
  align-self: flex-start;
  z-index: var(--z-sticky-subnav);
  background: var(--content-well);
}

.panel-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky-local);
  background: var(--surface-base);
}
```

Disable side-nav sticky on mobile; use horizontal tabs instead.

## Same approach, a card or list
Wrap items in a layout primitive (Stack/Grid) so the card sets **no outer margin**; give the
container its loading / empty / error states; use `.scroll-region-host` + `bind-scroll-overflow`
on the inner `.scroll-region` (visual-mechanics.md §2). See `architecture.md`,
`app-shell.md`, and `interaction.md`.
