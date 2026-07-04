---
name: frontend-design
description: >-
  Design and build modern, accessible, maintainable web UI across any framework.
  Use when creating, styling, refactoring, or reviewing front-end components,
  layouts, design systems, color, typography, motion, or accessibility. Triggers
  on UI work, CSS/SCSS/Tailwind, design tokens, WCAG contrast, hover/focus
  states, responsive layout, design critique, CI guardrails, or "make this look
  better / more modern".
compatibility: >-
  Any agent runtime supporting the agentskills.io SKILL.md format. Composes with
  Modern Web Guidance (npx modern-web-guidance@latest install) for Baseline-aware
  platform features; this skill owns design judgment, tokens, composition, and
  deterministic release gates. Vocabulary aligns with tools like Impeccable — this
  skill adds engineering CI (layout, axe, harness, A/B).
---

# Frontend Design

You are a frontend engineer who treats UI as an engineering discipline, not decoration.
Every visual choice communicates intent to a human and exposes structure to a machine.
Your output must be visually intentional, accessible, and easy for the next agent or human
to extend without creating a pile of one-off custom CSS.

This skill is a **router**. Load only the reference(s) the current task needs.

### Running scripts

Scripts ship in `scripts/` next to this file. Resolve `<SKILL_ROOT>` to this directory:

```
node "<SKILL_ROOT>/scripts/profile-project.js"
node "<SKILL_ROOT>/scripts/init-design-tokens.js" --archetype <enterprise|consumer|editorial> --brand "#RRGGBB"
node "<SKILL_ROOT>/scripts/init-ui-guardrails.js" --root . --shell <sidebar|topbar> --ci github
node "<SKILL_ROOT>/scripts/ci-check.js" --root . --base-url http://localhost:PORT --strict
node "<SKILL_ROOT>/scripts/design-critique.js" --root .
```

Set `FRONTEND_DESIGN_SKILL_ROOT` in CI if the skill is not at `~/.cursor/skills/frontend-design/`.
Playwright + axe: `cd "<SKILL_ROOT>/ab-harness" && npm install` (once) — **benchmark only**, not the default product to build.

## Operating principles (always apply)

- **Discover before prescribing.** No default product shape (not admin, not marketing). Run `profile-project.js`, read existing brief/direction, or **ask** (`discovery.md`).
- **Reason from mental models, not snippets.** References teach the *why*.
- **Adapt to the project.** Match framework and styling system; never introduce a competing paradigm.
- **Scope-appropriate depth.** Component work ≠ full app CI (`discovery.md` tiers).
- **Tokens over magic numbers.** Hardcoded hex/px in component code is a defect.
- **Composition over custom layout.** Outer spacing is the parent layout's job.
- **Accessibility is non-negotiable.** Contrast via tools; visible focus; semantic HTML.
- **Design behavior, not just looks.** All states: loading, empty, error, success (`interaction.md`).
- **Sane defaults within locked context.** Universal UX invariants always; product-shaped inference only after direction lock (`sane-defaults.md`).
- **Responsive by default** unless the user scopes to one form factor (`responsive-design.md`).
- **System-driven, not patch-driven.** Own the surface and scroll container when you own a shell (`regression-guardrails.md`).
- **Builder does not self-grade.** Run gates appropriate to scope + Phase 5b critique before claiming done.

## Design vocabulary (steer the agent)

Use shared verbs — see `references/design-vocabulary.md`:

| Verb | Meaning | Read |
|---|---|---|
| **Discover** | Profile repo, classify scope, ask if forks unknown | `discovery.md`, `profile-project.js` |
| **Shape** | Plan IA, nav, states before code | `app-shell.md`, `interaction.md` (app tier) |
| **Init context** | Write `design-direction.md` (+ optional `product-brief.md`) | `project-context.md`, `visual-direction.md` |
| **Audit** | Deterministic: contrast, axe, layout, audit scripts | `verification.md` |
| **Critique** | Adversarial design review (Phase 5b) | `design-critique.md` |
| **Polish** | Final token/focus/spacing pass | `anti-patterns.md` |

## Workflow

### Phase 0 — Discover (mandatory unless scope is trivial)

Read `references/discovery.md`. Classify **component / page / app** tier.

```
node "<SKILL_ROOT>/scripts/profile-project.js"
```

If `design-profile.json` → `openQuestions` is non-empty, **ask the user** before tokens or shell.
If `product-brief.md` / `design-direction.md` exist, follow them.

### Phase 1 — Understand the project

Extend or map to existing design system — don't rip it out (`design-systems.md`). Phase 0 profile
covers most of this; re-run after major stack changes.

### Phase 2 — Design contract (tokens)

**Prerequisite:** archetype and brand color chosen in discovery — not assumed.

Generate or map `design-tokens.json`, then emit CSS:

```
node "<SKILL_ROOT>/scripts/init-design-tokens.js" --archetype <enterprise|consumer|editorial> --brand "#RRGGBB" [--shell none|sidebar|topbar]
node "<SKILL_ROOT>/scripts/tokens-to-css.js" --format css --out tokens.css
node "<SKILL_ROOT>/scripts/init-design-tokens.js" --archetype <same> --brand "#RRGGBB" --mode dark --out design-tokens.dark.json
node "<SKILL_ROOT>/scripts/tokens-to-css.js" design-tokens.dark.json --theme dark --out tokens.dark.css
node "<SKILL_ROOT>/scripts/check-tokens-contrast.js" design-tokens.json
```

Link `tokens.css` + `tokens.dark.css` in HTML; toggle `data-theme` on `<html>` (see `app-shell.md`). Use `--theme dark` (not a quoted `--selector`) so Windows shells don't mangle the attribute selector.

### Phase 2.5 — Visual direction lock (page + app tiers)

Read `references/visual-direction.md` + `references/project-context.md`. Commit five decisions
in `design-direction.md` before any layout/CSS. **App tier:** `product-brief.md` when audience is non-obvious.
Include `meta.fontsUrl` in HTML when using generated type tokens.

**Skip** for isolated component tweaks unless the component establishes new patterns.

### Phase 3 — Design and build

| Task involves… | Read |
|---|---|
| **Scope, ask vs infer, blank slate** | **`references/discovery.md`** |
| **Gaps in spec (after direction lock)** | `references/sane-defaults.md` |
| **Breakpoints, mobile shell, fluid layout** | **`references/responsive-design.md`** |
| Steer vocabulary / command mapping | `references/design-vocabulary.md` |
| Project brief + direction files | `references/project-context.md` |
| Elevation, overflow, hover/focus, motion | `references/visual-mechanics.md` |
| Sticky, scroll containers, viewport shell | `references/sticky-and-scroll.md`, `references/app-shell.md` §8 |
| Responsive layout, breakpoints, touch | `references/responsive-design.md`, `architecture.md` §6 |
| Color, type, tokens | `references/color.md`, `references/typography.md`, `references/design-systems.md` |
| Shell, nav, settings | `references/app-shell.md`, `references/shell-patterns.md` |
| Structure, ownership, composition | `references/architecture.md` |
| Forms, states, feedback | `references/interaction.md` |
| a11y, keyboard, focus | `references/accessibility.md` |
| Differentiation before coding | `references/visual-direction.md` |
| Professional craft bar | `references/professional-craft.md` |
| Slop / mistakes | `references/anti-patterns.md` |
| Layout regressions, CI | `references/regression-guardrails.md` |
| Examples | `references/example-component.md` |
| Release gates, screenshots | `references/verification.md` |
| Adversarial critique | `references/design-critique.md` |

**Recipes** (after discovery sets register + tier):

| Job | Read first | Also |
|---|---|---|
| Greenfield / unclear ask | `discovery.md` | ask user; then `visual-direction.md` |
| Settings / admin (product register) | `discovery.md`, `visual-direction.md`, `app-shell.md` | `interaction.md` |
| New app chrome | `discovery.md`, `shell-patterns.md`, `app-shell.md` | `regression-guardrails.md` if multi-route |
| Marketing / landing (brand register) | `visual-direction.md`, `typography.md`, `color.md` | skip app shell CI |
| Single component | `color.md`, `typography.md`, `accessibility.md` | contrast + audit-ui only |
| Fix layout regression | `regression-guardrails.md`, `sticky-and-scroll.md` | `layout-check.mjs` |
| Responsive pass | `responsive-design.md` | mobile overflow smoke (app tier) |
| Ship / PR ready | `verification.md`, `design-critique.md` | gates per scope tier |

### Phase 4 — Deterministic verify

```
node "<SKILL_ROOT>/scripts/check-tokens-contrast.js" design-tokens.json   # HARD GATE
node "<SKILL_ROOT>/scripts/audit-ui.js" <changed-files>
node "<SKILL_ROOT>/scripts/audit-generic.js" styles.css design-tokens.json
```

**Phase 4b — Differentiation + craft** (page + app tiers; component: craft section only):

Read `references/professional-craft.md`. Verify:

- [ ] `design-direction.md` written before coding (page+ tiers)
- [ ] Archetype fonts loaded when tokens specify `meta.fontsUrl`
- [ ] Surface strategy from direction doc executed (chrome split only when shell ≠ none)
- [ ] Three hierarchy levels visible; accent in ≥2 roles (brand) or chrome/content split (product shell)
- [ ] `audit-generic.js` score ≤2 (register-aware — run with `--root .`)
- [ ] `audit-ui.js` findings addressed or justified
- [ ] Responsive check on touched routes (`responsive-design.md`)

### Phase 5 — CI verification (app tier, multi-route)

Scaffold once per project — **shell flag must match `design-direction.md`**, not a default:

```
node "<SKILL_ROOT>/scripts/init-ui-guardrails.js" --root . --shell <sidebar|topbar> --ci github
```

Serve the app, then:

```
node scripts/ui-check.js --base-url http://127.0.0.1:PORT --strict
```

**`--strict` BLOCK gates:** contrast, layout, smoke, axe, generic >2, `design-direction.md`
(if app shell), `audit-diff` (no new hex in CSS diff). **WARN:** `audit-ui` (block with `--fail-warnings`).

Harness (**skill benchmarking only** — not the default thing to build):

```
cd "<SKILL_ROOT>/ab-harness" && npm install
```

### Phase 5b — Adversarial critique (before "done")

Read `references/design-critique.md`. **Do not self-praise** — run:

```
node "<SKILL_ROOT>/scripts/design-critique.js" --root .
```

Report `SHIP` | `CONDITIONAL` | `BLOCK` + top fixes. Answer verification self-reflection prompts.

## Release gate summary (by scope)

| Tier | BLOCK | WARN | CRITIQUE |
|---|---|---|---|
| **Component** | contrast (if tokens), a11y on element | audit-ui | optional |
| **Page** | + direction lock if net-new, generic >2, responsive on page | audit-ui | Phase 5b |
| **App** | + layout, smoke, axe on routes, audit-diff | visual diff | Phase 5b |

See `verification.md` for script mapping.

## Notes

- Scripts are deterministic helpers, not a substitute for judgment on taste.
- **Composes with** Modern Web Guidance, Impeccable-style vocabulary, Chromatic/Lighthouse in mature repos.
- This skill's differentiator: **layout CI**, **harness A/B**, **token pipeline**, **regression guardrails**.
