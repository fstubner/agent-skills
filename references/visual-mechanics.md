# Visual Mechanics: Depth, Affordance, and Motion

Treat the viewport as a 3D stage with a vertical Z-axis. Light, shadow, and motion give users
instinctive cues about what an element *is* and *does*. Apply these as systematic rules, not
per-element guesses.

## 1. Elevation and the Z-axis

Higher elements catch more light and cast softer, more diffuse shadows onto what's below.

- A resting card sits low: a tight, low-opacity shadow.
- A menu, popover, or dropdown sits higher: a larger, softer, more diffuse shadow.
- A modal/dialog sits highest: the largest shadow, usually over a scrim.

Map these to tokens (`shadow-sm`, `shadow-md`, `shadow-lg`) rather than inventing values.
Shadows should be soft and ambient (large blur, low alpha), not hard 1px lines.

## 2. The Law of Content Occlusion (overflow)

When a container clips its content, the user needs a signal that more exists past the edge,
or they'll assume they've seen everything.

- The container edge is *above* the scrolling content on the Z-axis. Content slides *under* it.
- Signal this with an inset shadow or a gradient mask at the clipping edge — **only on the
  side(s) that actually have hidden content.** A permanent fade at the bottom when the user has
  scrolled to the end is a lie; it implies more content exists when it doesn't.

Toggle a `data-overflow` attribute from a scroll listener (or `ResizeObserver`). **Ship the
helper** from this skill rather than reimplementing:

```
node <SKILL_ROOT>/scripts/bind-scroll-overflow.js   # prints setup snippet
// or require('./bind-scroll-overflow') and call bindAllScrollOverflow('.scroll-region')
```

```js
function bindScrollOverflow(el) {
  const update = () => {
    const { scrollTop, scrollHeight, clientHeight } = el;
    const tokens = [];
    if (scrollTop > 1) tokens.push('top');
    if (scrollTop + clientHeight < scrollHeight - 1) tokens.push('bottom');
    el.dataset.overflow = tokens.length ? tokens.join(' ') : 'none';
  };
  el.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(el);
  update();
}
```

```html
<!-- Host holds border + fades; inner element scrolls and owns data-overflow -->
<div class="scroll-region-host">
  <div class="scroll-region" tabindex="0" role="region" aria-label="…">
    <!-- list content -->
  </div>
</div>
```

```css
/* Host: chrome, fades as overlays — never mask the scroll container (masks clip the scrollbar) */
.scroll-region-host {
  position: relative;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  --scroll-fade-surface: var(--surface-raised); /* match inner background */
}

.scroll-region-host .scroll-region {
  max-height: calc(var(--space-8) * 4);
  overflow-y: auto;
  border: none;
  background: transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}

.scroll-region-host .scroll-region::-webkit-scrollbar {
  width: var(--scrollbar-gutter, 10px);
}

.scroll-region-host .scroll-region::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: var(--radius-full);
}

@media (hover: hover) {
  .scroll-region-host .scroll-region::-webkit-scrollbar-thumb:hover {
    background: var(--text-muted);
  }
}

/* Overlays sit above content, stop before the scrollbar gutter */
.scroll-region-host::before,
.scroll-region-host::after {
  content: "";
  position: absolute;
  left: 0;
  right: var(--scrollbar-gutter, 10px);
  height: var(--fade-size);
  pointer-events: none;
  z-index: 1;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.scroll-region-host::before {
  top: 0;
  border-top-left-radius: inherit;
  background: linear-gradient(to bottom, var(--scroll-fade-surface), transparent);
}

.scroll-region-host::after {
  bottom: 0;
  border-bottom-left-radius: inherit;
  background: linear-gradient(to top, var(--scroll-fade-surface), transparent);
}

/* Toggle each edge independently — top only, bottom only, both, or neither */
.scroll-region-host:has(.scroll-region[data-overflow~="top"])::before {
  opacity: 1;
}

.scroll-region-host:has(.scroll-region[data-overflow~="bottom"])::after {
  opacity: 1;
}
```

**Do not** put `mask-image` on `.scroll-region` — it fades the scrollbar track and looks
inconsistent across browsers. Overlays on the host use the same `--scroll-fade-surface` token
for top and bottom so both edges match.

Gradient directions are physical; mirror for RTL (`[dir="rtl"]` swaps `left`/`right` on overlays).
A scrollbar alone is a weak signal (often hidden on macOS/touch). Style it with tokens and pair
with the dynamic overlays above — not instead of them.

## 3. The interaction state matrix

Interactive elements model physical feedback. Apply this consistently:

| State | Physical metaphor | Properties to change | Guidance |
|---|---|---|---|
| Rest | At rest | — | Baseline surface + ambient shadow |
| `:hover` | Lifts / warms under the cursor | `background-color`, `transform`, `box-shadow` | Shift surface one token step; optional `translateY(-1px)`; slightly larger shadow |
| `:active` | Pressed down | `transform`, `box-shadow` | Return to `translateY(0)`, flatten shadow — feels like a press |
| `:focus-visible` | Keyboard beacon | `outline`, `outline-offset` | Always a clear high-contrast ring. Never `outline: none` without a replacement |
| `:disabled` | Inert | `opacity`, `cursor` | Reduce saturation/opacity; `cursor: not-allowed`; remove hover/active response |

Every clickable element gets `cursor: pointer` and a visible hover *and* focus state. Hover-only
feedback is invisible to keyboard and touch users — gate hover-specific effects behind
`@media (hover: hover)` and make sure the element already looks interactive without hover (border,
fill, or label) so touch users get the cue too.

## 4. Motion and transitions

Motion should explain a state change, not decorate. If something moves, the user should be able
to say why. Use the contract's motion tokens (`duration-fast/base/slow`, `ease-standard`) instead
of literal values.

- **Duration:** micro-interactions (hover, press, small toggles) 100–200ms. Larger transitions
  (panels, sheets, route changes) 200–400ms. Slower than that feels sluggish.
- **Easing:** use `ease-out` or a custom cubic-bezier for entrances and interactions (decelerates,
  feels physical). Avoid `linear` for UI movement — it reads as mechanical.
- **Performance:** animate only `transform` and `opacity` (compositor-friendly). Avoid animating
  `width`, `height`, `top/left`, or `margin` — they trigger layout/paint and cause jank.
- **Respect preferences:** honor `prefers-reduced-motion: reduce` by removing or shortening
  non-essential motion.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

## 5. Parallax and depth scrolling (use sparingly)

Parallax simulates depth: near layers move faster than far layers as you scroll.

- Drive it with `transform: translate3d(...)` (GPU), updated from a scroll/`IntersectionObserver`
  handler that is throttled to `requestAnimationFrame`. Never write scroll handlers that do
  layout-reading + writing synchronously.
- Keep displacement subtle (background moves at ~0.2–0.5× foreground). Heavy parallax causes
  motion sickness and hurts performance.
- Always disable under `prefers-reduced-motion`.

## 6. Skeletons over spinners

For content that's loading into a known layout, render gray pulsing placeholders shaped like the
incoming content. This reduces perceived wait and prevents layout shift. Reserve spinners for
indeterminate, non-structural waits.
