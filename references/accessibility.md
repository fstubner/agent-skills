# Accessibility: The Must-Check List

Contrast is the hard gate (see `color.md` and `check-contrast.js`), but accessibility is broader.
These checks are evergreen — apply them to everything you build. Delegate the detailed *mechanics*
to the authorities in `resources.md`: keyboard/role/state behavior to the **ARIA Authoring
Practices Guide (APG)**, accessible component builds to **Inclusive Components**, and the formal
success criteria to **WCAG 2.2**.

> Rule of thumb: reach for a native element first. A real `<button>`, `<a>`, `<select>`, `<dialog>`,
> or `<input>` brings focus, keyboard, and semantics for free. Only add ARIA when no native element
> fits — and then follow the APG pattern exactly. Bad ARIA is worse than none.

## Structure and semantics
- One `<h1>` per page; headings descend in order (don't skip levels for size — use type tokens).
- Wrap regions in landmarks: `<header>`, `<nav>`, `<main>`, `<footer>`. One `<main>` per page.
- Use lists (`<ul>`/`<ol>`) for lists, `<table>` for tabular data (not for layout).

## Names and labels
- Every interactive control has an accessible name. Inputs need an associated `<label>` (`for`/`id`
  or wrapping). Icon-only buttons need `aria-label`.
- Images: meaningful ones need descriptive `alt`; decorative ones get empty `alt=""` (or
  `aria-hidden`). Decorative icons inside labeled controls should be `aria-hidden="true"`.

## Keyboard
- Everything operable with a mouse must work with the keyboard alone, in a logical tab order.
- Keep a visible `:focus-visible` indicator (≥3:1 against adjacent colors). Never `outline: none`
  without a replacement.
- No keyboard traps. Provide a "skip to main content" link as the first focusable element.

## Focus management (dynamic UI)
- Opening a modal/menu/drawer: move focus into it; trap focus while open; restore focus to the
  trigger on close. (Native `<dialog>` handles much of this.)
- After async navigation or content swaps, move focus to the new content or a heading so screen
  readers aren't stranded.

## Announcing change
- Communicate async status (loading, saved, errors) via a polite live region (`aria-live="polite"`
  or a status role), not by visual change alone (ties to "visibility of system status" in
  `interaction.md`).

## User preferences (respect the OS)
- `prefers-reduced-motion` — remove/shorten non-essential motion (see `visual-mechanics.md`).
- `prefers-color-scheme` + set the CSS `color-scheme` property so form controls/scrollbars theme
  correctly.
- `prefers-contrast` — don't fight a user's high-contrast request.

## Pointer, touch, and target size
- Don't make hover the *only* affordance; gate hover effects behind `@media (hover: hover)` and
  ensure a non-hover cue (see `visual-mechanics.md`).
- Target size: WCAG 2.2 minimum is 24×24px (SC 2.5.8); aim for ~44px for primary touch targets.

## Don't rely on color alone
- Pair color-coded meaning (status, required, selected) with an icon, text, or shape so it survives
  color-blindness and grayscale (see `color.md`).

## WCAG 2.2 additions worth knowing
Target size (2.5.8), focus appearance, dragging alternatives, consistent help, redundant-entry and
accessible-authentication relief. Check these on flows with drag, multi-step forms, or auth.
