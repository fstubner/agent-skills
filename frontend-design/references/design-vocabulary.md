# Design Vocabulary — Steer Without Re-explaining

Agents and humans need **shared verbs** for design work. This maps a practical vocabulary to this
skill's phases and references — use the words in requests; the agent loads the right mental model.

**Composes with** tools like [Impeccable](https://impeccable.style) (commercial vocabulary + detect CLI).
This skill owns **engineering guardrails** (tokens, layout CI, harness); vocabulary steers *what* to do.

## Registers: product vs brand

| Register | When | Examples |
|---|---|---|
| **Product** | App UI — tools, dashboards, settings (after discovery) | Shell, density, states, tables |
| **Brand** | Marketing — landing, launch, editorial | Display type, hero, narrative rhythm |

State the register during **discovery** (`discovery.md`). Product-shaped references apply only after
register + tier are confirmed — not by default.

## Command map

| You say… | Phase / action | Read |
|---|---|---|
| **Discover** | Profile + classify scope; ask if forks open | `discovery.md`, `profile-project.js` |
| **Shape** | Plan IA, nav, states before code | `discovery.md`, then `app-shell.md` if app tier |
| **Init context** | Write `design-direction.md` (+ optional `product-brief.md`) | `project-context.md`, `visual-direction.md` |
| **Typeset** | Type hierarchy, fonts, scale | `typography.md`, Phase 2.5 §2 |
| **Colorize** | Palette, surfaces, accent roles | `color.md`, `design-systems.md` |
| **Layout** / shell | Chrome, viewport lock, scroll regions | `app-shell.md` §8, `sticky-and-scroll.md` |
| **Responsive** | Breakpoints, fluid layout, mobile shell | `responsive-design.md` |
| **Compose** | Components + layout primitives | `architecture.md`, `example-component.md` |
| **Animate** | Motion, reduced-motion | `visual-mechanics.md` |
| **Harden** | Edge cases, overflow, i18n, errors | `interaction.md`, `regression-guardrails.md` |
| **Audit** (technical) | Deterministic scripts | Phase 4 — `audit-ui.js`, `axe-check.mjs`, `ci-check.js` |
| **Critique** (subjective) | Adversarial design review | Phase 5b — `design-critique.md` |
| **Polish** | Final pass — tokens, spacing, focus, ship | Phase 4b + `anti-patterns.md` |
| **Normalize** | Align to existing DS / tokens | `design-systems.md` |
| **Distill** | Extract reusable tokens/components | `architecture.md`, `init-design-tokens.js` |

## Typical flows

**New product page:** Shape → Init context → Layout → Compose → Audit → Critique → Polish

**Fix regression:** Identify surface owner → Layout check → Audit diff → Capture screenshots

**Steer live:** "Quieter accent" → `color.md`; "Bolder hierarchy" → `typography.md` + `visual-direction.md` §5

## What vocabulary cannot do

Vocabulary improves defaults and coordination. It does **not** replace:

- Contrast math (`check-tokens-contrast.js`)
- Layout metrics (`layout-check.mjs`)
- axe violations (`axe-check.mjs`)
- Independent critique (builder must not self-grade — Phase 5b)
