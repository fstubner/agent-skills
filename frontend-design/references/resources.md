# Resources: Authoritative Grounding

Use these sources to settle design and engineering decisions. They are the "why" behind this
skill's rules. Cite them when justifying a choice; consult them when a situation isn't covered
here.

> Ground claims in a source. If you're unsure whether a guideline or spec is real or current,
> verify it (check the links below or search) before asserting it — and don't claim a source is
> fabricated just because it post-dates your training data. The web platform moves fast.

## Design and UX

- **Refactoring UI** — Adam Wathan & Steve Schoger. Concrete rules for hierarchy, spacing, color,
  and shadows without a design background. The most directly applicable to this skill.
- **The Design of Everyday Things** — Don Norman. Affordances and signifiers: why a control must
  look like what it does.
- **Don't Make Me Think** — Steve Krug. Reducing cognitive load; making layouts self-evident.
- **Designing Interfaces** — Jenifer Tidwell. A catalog of reusable layout and interaction patterns.

## Usability & interaction (evergreen principles)

- **NN/g — 10 Usability Heuristics** — https://www.nngroup.com/articles/ten-usability-heuristics/ —
  Nielsen's interaction heuristics; unchanged since 1994 and the default usability checklist. The
  basis of `interaction.md`.
- **Laws of UX** — https://lawsofux.com/ — Fitts's, Hick's, Jakob's, and Miller's laws (and more):
  the psychology behind target size, choice count, conventions, and chunking.

## Accessibility (authoritative)

- **WCAG 2.2** — https://www.w3.org/TR/WCAG22/ — the contrast/keyboard/structure requirements this
  skill enforces (AA contrast: 4.5:1 normal text, 3:1 large text and UI components).
- **ARIA Authoring Practices Guide (APG)** — https://www.w3.org/WAI/ARIA/apg/ — correct roles,
  states, and keyboard interaction for menus, dialogs, tabs, comboboxes, etc.
- **MDN Accessibility** — https://developer.mozilla.org/en-US/docs/Web/Accessibility
- **Inclusive Components** — https://inclusive-components.design/ (Heydon Pickering) — worked,
  accessible builds of real components (toggles, menus, tabs, cards). Pairs with the APG.

> **Contrast algorithm note:** WCAG 2.2's luminance-ratio contrast (what `check-contrast.js`
> implements) is the binding standard. **APCA** (a perceptual model, https://apcacontrast.com/) is
> a useful *secondary* readability check, especially for dark mode — but it was pulled from the
> WCAG 3 working draft and is not yet normative. Gate on WCAG 2.2; treat APCA as advice.

## Web platform and CSS (authoritative)

- **MDN Web Docs** — https://developer.mozilla.org/ — the reference for HTML/CSS/JS APIs.
- **web.dev** — https://web.dev/ — practical performance and UX guidance from Chrome's team.
- **Core Web Vitals** — https://web.dev/articles/vitals — LCP (loading), INP (responsiveness),
  CLS (visual stability). Use INP guidance to justify "give feedback before awaiting async work".
- **Baseline (Web Platform)** — https://web.dev/baseline — check whether a feature is broadly
  supported before relying on it. Prefer Baseline features over polyfill-heavy approaches.

## Component patterns & platform conventions

Delegate component anatomy, naming, and platform behavior to these — don't reinvent a date picker
or a menu from scratch:

- **Material Design 3** — https://m3.material.io/ — Google's open design system; component specs,
  states, and theming. Strong for Android / cross-platform and web.
- **Apple Human Interface Guidelines** — https://developer.apple.com/design/human-interface-guidelines
  — principles and behavior for Apple platforms; the reference for native iOS/macOS feel.
- **GOV.UK Design System** — https://design-system.service.gov.uk/ — gold standard for accessible,
  content-led **form and task** patterns. Consult for forms, error summaries, and question flows.

## Layout primitives

- **Every Layout** — https://every-layout.dev/ (Heydon Pickering & Andy Bell) — the source of the
  Stack / Cluster / Center / Grid / Sidebar primitives in `architecture.md`. Read it for
  composable, media-query-free layout that leverages the browser's own algorithms.

## Design tokens (interchange format)

- **Design Tokens (DTCG) format 2025.10** — https://www.designtokens.org/ — the stable,
  vendor-neutral JSON format (`$value` / `$type`) for design tokens, supported by Figma, Style
  Dictionary, Tokens Studio, and others. This skill's `design-tokens.json` uses a simpler flat
  shape for easy authoring; if a project already uses DTCG, follow that instead (see
  `design-systems.md`).

## Agent-facing web standards (current)

- **Modern Web Guidance** — Chrome team, unveiled at Google I/O 2026. An expert-vetted, evergreen
  *skills package* (works with any AI coding agent) covering 100+ use cases across performance,
  accessibility, security, and UX, with Baseline-aware cross-browser fallbacks.
  - Docs: https://developer.chrome.com/docs/modern-web-guidance/get-started
  - Repo: https://github.com/GoogleChrome/modern-web-guidance · Install: `npx modern-web-guidance@latest install`
  - **This skill defers to Modern Web Guidance for platform-feature, compatibility, and
    fallback specifics.** It is authoritative and auto-updating where our static notes are not.
    Treat it as the source of truth for "is this feature safe to use and how do I fall back?"
  - Adjacent agentic-web work lives here too (e.g. **WebMCP** — a W3C proposal in Chrome origin
    trial for exposing callable page tools to in-browser agents:
    https://developer.chrome.com/docs/ai/webmcp). Only relevant if a project explicitly targets
    agentic browsing; consult Modern Web Guidance / the docs when it is.

## How to use these

1. Prefer the project's own conventions and existing design system first.
2. For usability/interaction calls, apply NN/g heuristics and Laws of UX (`interaction.md`); for
   accessibility, treat WCAG 2.2 / APG as binding (`accessibility.md`).
3. For component anatomy and platform behavior, follow Material 3 / Apple HIG / GOV.UK rather than
   inventing patterns.
4. For platform features, compatibility, and fallbacks, defer to **Modern Web Guidance** if
   available (it's auto-updating); otherwise confirm support via MDN/Baseline before shipping.
5. For visual/UX judgment calls, reason from Refactoring UI and Norman's principles.
6. If the agent runtime supports them, install Modern Web Guidance alongside this skill — they
   compose: this skill owns design judgment, tokens, and composition; MWG owns platform specifics.
