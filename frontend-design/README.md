# Frontend Design Skill

Agent skill for **intentional, accessible** web UI — tokens, visual craft, layout CI, and
adversarial **design** critique.

**Home:** [fstubner/agent-skills](https://github.com/fstubner/agent-skills) (`frontend-design/`).

**Charter freeze:** this skill owns the **visual system**, not stack selection or product SHIP.
See [`_suite-charters/`](../_suite-charters/). Sibling skills:

| Skill | Owns |
|---|---|
| `build` | Thin suite router |
| `frontend-engineering` | Job→stack, structure gates |
| `systems-architecture` | Boundaries, trust |
| `product-acceptance` | Outcome vs PRODUCT.md (builder ≠ acceptor) |
| [frescowork](https://github.com/fstubner/frescowork) | Live preview feedback (product, not a skill) |

## What this skill is

| Layer | Contents |
|---|---|
| **Mental models** | Reference docs (shell, sticky, tokens, motion, a11y, …) |
| **Token pipeline** | `init-design-tokens.js` → contrast gate → CSS emit |
| **Differentiation** | Phase 2.5 direction lock, `audit-generic.js` |
| **Regression CI** | `init-ui-guardrails`, `ci-check`, layout + axe + smoke |
| **Critique** | Phase 5b `design-critique.js` — visual SHIP/BLOCK |
| **Proof** | A/B harness, capture/compare |

## Install

Copy `frontend-design/` to `~/.cursor/skills/` (or project `.cursor/skills/`).

## Quick start

**Discover first** — no default admin chrome. **Stack first** on page/app if unknown.

```bash
# 0. Discover; read openQuestions + needsStackInterview
node scripts/profile-project.js
# → if needsStackInterview: run frontend-engineering (do not lock vanilla / default React)
# → if other openQuestions: ask register, archetype, shell, brand, theme

# 1. Lock direction (page + app tiers)
cp templates/project-context/design-direction.template.md design-direction.md

# 2. Tokens (after archetype + brand — and stack locked when needed)
node scripts/init-design-tokens.js --archetype <enterprise|consumer|editorial> --brand "#…"
node scripts/tokens-to-css.js --format css --out tokens.css
node scripts/check-tokens-contrast.js design-tokens.json

# 3. CI guardrails (app tier; --shell matches design-direction.md)
node scripts/init-ui-guardrails.js --root . --shell <sidebar|topbar> --ci github

# 4. Visual verify + critique (product SHIP → product-acceptance, separate turn)
node scripts/design-critique.js --root .
```

## Structure

```
frontend-design/
  SKILL.md                     Router + phased workflow
  references/                  Mental models (load on demand)
    discovery.md                 Blank slate — scope tiers, ask vs script
    design-vocabulary.md         Shared verbs (shape, audit, critique, …)
    project-context.md         product-brief.md + design-direction.md
    design-critique.md         Phase 5b adversarial review
    regression-guardrails.md   Layout CI, patch stop condition
    verification.md            BLOCK / WARN / CRITIQUE tiers
  scripts/
    ci-check.js                CI orchestrator
    init-ui-guardrails.js      Scaffold project CI
    layout-check.mjs           Layout invariant tests
    axe-check.mjs              axe on fragile routes
    audit-diff.js              Hex in CSS diff gate
    design-critique.js         SHIP/BLOCK aggregator
    …                          tokens, audit, self-check
  templates/
    ui-guardrails/             fragile-surfaces, GitHub workflow
    project-context/           brief + direction templates
  ab-harness/                  A/B spec, Playwright capture/smoke
```

## Scripts reference

```
node scripts/check-tokens-contrast.js design-tokens.json    # HARD GATE
node scripts/audit-ui.js src/styles.css
node scripts/audit-generic.js styles.css design-tokens.json
node scripts/audit-diff.js --base main
node scripts/ci-check.js --root . --base-url http://127.0.0.1:PORT --strict
node scripts/design-critique.js --root .
node scripts/init-ui-guardrails.js --root . --shell <sidebar|topbar> --ci github  # after discovery
```

## Self-improvement loop

Measure → fix skill/scripts → re-measure:

```bash
node scripts/discovery-smoke.js
node ab-harness/scripts/run-quality-benchmark.mjs --scenarios-dir /path/to/discovery-tests
```

Target: aggregate quality score ↑, generic findings ↓, BLOCK verdicts = 0.
