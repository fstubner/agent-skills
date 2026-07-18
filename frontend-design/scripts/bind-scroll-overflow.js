#!/usr/bin/env node
// Bind dynamic scroll-edge overflow cues on scrollable elements.
// Sets data-overflow="top bottom" | "bottom" | "none" from scroll position so CSS
// masks only appear when content is actually clipped (visual-mechanics.md §2).
//
// Usage:
//   const { bindScrollOverflow, bindAllScrollOverflow } = require('./bind-scroll-overflow');
//   bindAllScrollOverflow('.scroll-region');
//   // or: document.querySelectorAll('.scroll-region').forEach(bindScrollOverflow);
//
// CLI (prints a one-liner for quick setup):
//   node bind-scroll-overflow.js

'use strict';

function bindScrollOverflow(el) {
  if (!el || typeof el.addEventListener !== 'function') return;

  const update = () => {
    const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = el;
    const tokens = [];
    if (scrollTop > 1) tokens.push('top');
    if (scrollTop + clientHeight < scrollHeight - 1) tokens.push('bottom');
    if (scrollLeft > 1) tokens.push('left');
    if (scrollLeft + clientWidth < scrollWidth - 1) tokens.push('right');
    el.dataset.overflow = tokens.length ? tokens.join(' ') : 'none';
  };

  el.addEventListener('scroll', update, { passive: true });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(update).observe(el);
  }
  update();
}

function bindAllScrollOverflow(selector, root) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll(selector).forEach(bindScrollOverflow);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { bindScrollOverflow, bindAllScrollOverflow };
}

if (require.main === module) {
  console.log(`
bind-scroll-overflow — dynamic edge fades for scroll regions

In your app bundle:
  const { bindAllScrollOverflow } = require('<skill-root>/scripts/bind-scroll-overflow');
  bindAllScrollOverflow('.scroll-region');

Or inline after DOM ready:
  document.querySelectorAll('.scroll-region').forEach((el) => {
    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const t = [];
      if (scrollTop > 1) t.push('top');
      if (scrollTop + clientHeight < scrollHeight - 1) t.push('bottom');
      el.dataset.overflow = t.length ? t.join(' ') : 'none';
    };
    el.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(el);
    update();
  });

Pair with CSS — host overlays, not mask on the scroller (visual-mechanics.md §2):

  <div class="scroll-region-host">
    <div class="scroll-region">…</div>
  </div>

  .scroll-region-host:has(.scroll-region[data-overflow~="bottom"])::after {
    opacity: 1; /* gradient overlay; right: var(--scrollbar-gutter) */
  }
`.trim());
}
