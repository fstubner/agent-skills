# Frontend Design Skill

Agent skill for **intentional, accessible, maintainable** web UI — with deterministic release gates,
layout regression CI, and adversarial critique.

This repository is the **Cursor agent skill** (scripts, references, templates, A/B harness). The complementary preview runtime product lives separately in [fstubner/frescowork](https://github.com/fstubner/frescowork).

## What this skill is

| Layer | Contents |
|---|---|
| **Mental models** | 15+ reference docs (shell, sticky, tokens, motion, a11y, …) |
| **Token pipeline** | `init-design-tokens.js` → contrast gate → CSS emit |
| **Differentiation** | Phase 2.5 direction lock, `audit-generic.js` |
| **Regression CI** | `init-ui-guardrails`, `ci-check`, layout + axe + smoke |
| **Critique** | Phase 5b `design-critique.js` — SHIP/BLOCK verdict |
| **Proof** | A/B harness, capture/compare |

Composes with [Impeccable](https://impeccable.style)-style vocabulary; this skill adds **engineering CI** and **harness**.

## Install

Copy `frontend-design/` to `~/.cursor/skills/` (or project `.cursor/skills/`).

## Quick start

**Discover first** — the skill does not assume admin dashboards or enterprise chrome.

```bash
# 0. Discover stack + scope; read openQuestions in output
node scripts/profile-project.js
# → if openQuestions non-empty: ask user (register, archetype, shell, brand, theme)
# → see references/discovery.md

# 1. Lock direction (page + app tiers)
cp templates/project-context/design-direction.template.md design-direction.md
# edit five decisions — see references/visual-direction.md

# 2. Tokens (after archetype + brand are chosen — not defaulted)
node scripts/init-design-tokens.js --archetype <enterprise|consumer|editorial> --brand "#…"
node scripts/tokens-to-css.js --format css --out tokens.css
node scripts/check-tokens-contrast.js design-tokens.json

# 3. CI guardrails (app tier only; --shell must match design-direction.md)
node scripts/init-ui-guardrails.js --root . --shell <sidebar|topbar> --ci github
cd ab-harness && npm install

# 4. Verify before ship (gates per scope tier — verification.md)
python -m http.server 4173 &
node scripts/ui-check.js --base-url http://127.0.0.1:4173 --strict
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
