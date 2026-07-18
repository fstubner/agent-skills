---
name: frontend-design
description: >-
  Design modern, accessible, intentional web UI: tokens, visual direction, craft,
  anti-slop, contrast/layout/axe gates, and design critique. Use when styling,
  theming, layout craft, typography, color, motion, or visual review. For
  greenfield stack choice, monolith structure, or framework selection use
  frontend-engineering first. For product SHIP vs brief use product-acceptance.
compatibility: >-
  Any agent runtime supporting the agentskills.io SKILL.md format. Owns visual
  judgment, tokens, and deterministic design gates. Stack/structure owned by
  frontend-engineering; outcome acceptance by product-acceptance.
---

# Frontend Design

You own **visual design systems and craft**, not framework selection or product
sign-off. Treat UI as intentional, accessible, and token-driven — without
rawdogging a new stack when engineering has not locked one.

This skill is a **router**. Load only the reference(s) the current task needs.

**Suite:** charters in `~/.cursor/skills/_suite-charters/`. Stack → `frontend-engineering`. Outcome SHIP → `product-acceptance` (separate turn).

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
Playwright + axe: `cd "<SKILL_ROOT>/ab-harness" && npm install` (once) — **benchmark only**.

## Operating principles (always apply)

- **Discover before prescribing.** No default product shape. Run `profile-project.js`, read brief/direction, or **ask** (`discovery.md`).
- **Stack before polish on page/app.** If `needsStackInterview` or unknown/vanilla without `stack-decision.md`, invoke **frontend-engineering** — do not lock vanilla forever; do not default to React.
- **Reason from mental models, not snippets.**
- **Adapt to the locked project stack.** Never introduce a competing paradigm after stack is decided.
- **Scope-appropriate depth.** Component work ≠ full app CI.
- **Tokens over magic numbers.**
- **Composition over custom layout.** Outer spacing is the parent layout's job.
- **Accessibility is non-negotiable.** Contrast via tools; visible focus; semantic HTML.
- **Design behavior, not just looks.** States: loading, empty, error, success (`interaction.md`) — full UX acceptance is product-acceptance / frontend-ux charter.
- **Sane defaults within locked context** (`sane-defaults.md`).
- **Responsive by default** unless scoped otherwise.
- **System-driven, not patch-driven** (`regression-guardrails.md`).
- **Builder does not self-grade product SHIP.** Design-critique is visual; **product-acceptance** is outcome (separate turn).

## Design vocabulary

| Verb | Meaning | Read |
|---|---|---|
| **Discover** | Profile + design forks; hand off stack if needed | `discovery.md`, `profile-project.js` |
| **Shape** | Plan IA/nav/states before visuals (app tier) | `app-shell.md`, `interaction.md` |
| **Init context** | `design-direction.md` (+ product brief / PRODUCT.md) | `project-context.md`, `visual-direction.md` |
| **Audit** | Contrast, axe, layout, audit scripts | `verification.md` |
| **Critique** | Adversarial **visual** review | `design-critique.md` |
| **Polish** | Token/focus/spacing pass | `anti-patterns.md` |

## Workflow

### Phase 0 — Discover

Read `references/discovery.md`. Classify **component / page / app**.

```
node "<SKILL_ROOT>/scripts/profile-project.js"
```

- If `needsStackInterview` → **stop** → frontend-engineering → resume here after `stack-decision.md`
- If `openQuestions` non-empty → ask before tokens/shell
- If `PRODUCT.md` / `product-brief.md` / `design-direction.md` exist → follow them

### Phase 1 — Understand the project

Extend existing design system (`design-systems.md`). Do not rip out the locked stack.

### Phase 2 — Design contract (tokens)

**Prerequisite:** archetype and brand chosen — and stack locked when page/app was undecided.

```
node "<SKILL_ROOT>/scripts/init-design-tokens.js" --archetype <enterprise|consumer|editorial> --brand "#RRGGBB" [--shell none|sidebar|topbar]
node "<SKILL_ROOT>/scripts/tokens-to-css.js" --format css --out tokens.css
node "<SKILL_ROOT>/scripts/init-design-tokens.js" --archetype <same> --brand "#RRGGBB" --mode dark --out design-tokens.dark.json
node "<SKILL_ROOT>/scripts/tokens-to-css.js" design-tokens.dark.json --theme dark --out tokens.dark.css
node "<SKILL_ROOT>/scripts/check-tokens-contrast.js" design-tokens.json
```

### Phase 2.5 — Visual direction lock (page + app)

Read `visual-direction.md` + `project-context.md`. Commit five decisions in `design-direction.md` before layout/CSS.

### Phase 3 — Design and build

| Task involves… | Read |
|---|---|
| Scope, blank slate, stack handoff | **`discovery.md`** |
| Spec gaps after direction lock | `sane-defaults.md` |
| Responsive | `responsive-design.md` |
| Elevation, overflow, focus, motion | `visual-mechanics.md` |
| Sticky / scroll / shell | `sticky-and-scroll.md`, `app-shell.md` |
| Color, type, tokens | `color.md`, `typography.md`, `design-systems.md` |
| Visual structure / ownership | `architecture.md` (visual maintainability; eng owns stack modules) |
| Forms, states | `interaction.md` |
| a11y | `accessibility.md` |
| Differentiation | `visual-direction.md`, `professional-craft.md` |
| Slop | `anti-patterns.md` |
| Layout CI | `regression-guardrails.md` |
| Release gates | `verification.md` |
| Visual critique | `design-critique.md` |

### Phase 4 — Deterministic verify

```
node "<SKILL_ROOT>/scripts/check-tokens-contrast.js" design-tokens.json
node "<SKILL_ROOT>/scripts/audit-ui.js" <changed-files>
node "<SKILL_ROOT>/scripts/audit-generic.js" styles.css design-tokens.json
```

**Phase 4b — Craft** (page + app): see `professional-craft.md`.

### Phase 5 — CI (app tier)

```
node "<SKILL_ROOT>/scripts/init-ui-guardrails.js" --root . --shell <sidebar|topbar> --ci github
node scripts/ui-check.js --base-url http://127.0.0.1:PORT --strict
```

### Phase 5b — Visual critique (before claiming design done)

```
node "<SKILL_ROOT>/scripts/design-critique.js" --root .
```

Then hand **product** SHIP to **product-acceptance** in a separate turn.

## Release gate summary (visual)

| Tier | BLOCK | WARN | CRITIQUE |
|---|---|---|---|
| **Component** | contrast (if tokens), a11y on element | audit-ui | optional |
| **Page** | + direction lock if net-new, generic >2, responsive | audit-ui | Phase 5b |
| **App** | + layout, smoke, axe, audit-diff | visual diff | Phase 5b |

Product outcome gates: **product-acceptance**. Structure gates: **frontend-engineering**.

## Notes

- Differentiator remains: token pipeline, layout CI, harness A/B, regression guardrails, design-critique.
- Charter freeze: `~/.cursor/skills/_suite-charters/frontend-design.md`
