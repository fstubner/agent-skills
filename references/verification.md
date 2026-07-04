# Verification and Release Gates

Agents **prove** UI quality — they do not assert it. This skill uses a **three-tier** model
aligned with industry design-QA practice (block / warn / critique).

## Tool stack

| Tool | What it answers | Tier |
|------|-----------------|------|
| `check-tokens-contrast.js` | Semantic color accessibility | **BLOCK** |
| `axe-check.mjs` | WCAG violations on live routes | **BLOCK** (serious/critical) |
| `layout-check.mjs` | Shell offset, viewport lock, horizontal overflow | **BLOCK** |
| `smoke.mjs` | Routes, toggles, forms, **mobile overflow** | **BLOCK** |
| `audit-generic.js` | Generic SaaS smell | **BLOCK** if score >2 (`--strict`) |
| `audit-diff.js` | New hex/px in CSS diff | **BLOCK** (`--strict`) |
| `audit-ui.js` | Craft heuristics | **WARN** (BLOCK with `--fail-warnings`) |
| `capture.mjs` + `compare.mjs` | Pixel regression | **WARN** (human approves diffs) |
| `design-critique.js` | SHIP / CONDITIONAL / BLOCK synthesis | **CRITIQUE** |
| `ci-check.js` | Orchestrates all of the above | Writes `ui-check-report.json` |

## Project CI setup (app tier, after direction lock)

Guardrails must match the **shell chosen in discovery** — not a skill default.

```bash
# After design-direction.md records shell (sidebar | topbar):
node "<SKILL_ROOT>/scripts/init-ui-guardrails.js" --root . --shell <sidebar|topbar> --ci github
cd "<SKILL_ROOT>/ab-harness" && npm install
```

Edit `ui-guardrails/fragile-surfaces.json` and ensure `design-direction.md` exists.

```bash
# Serve app, then:
node scripts/ui-check.js --base-url http://127.0.0.1:4173 --strict
node "<SKILL_ROOT>/scripts/design-critique.js" --root .
```

## Scope-tier gates

Run only what matches the work — do not apply full app CI to a single component tweak.

| Tier | BLOCK | WARN | CRITIQUE |
|---|---|---|---|
| **Component** | contrast (if tokens), axe on story/route if present | `audit-ui.js`, `audit-diff` on touched CSS | optional |
| **Page / view** | + responsive overflow, states, generic audit (`--strict`) | capture/compare if baselines exist | Phase 5b on net-new surfaces |
| **App / product** | + `layout-check`, smoke routes, missing `design-direction.md` when shell detected | full `audit-ui`, pixel diff | Phase 5b required |

See `discovery.md` for when to ask vs script before locking direction.

### `--strict` block gates (app tier adds)

- Contrast fail
- axe serious/critical on configured routes
- Layout metric fail
- Smoke fail
- Generic score > 2
- Missing `design-direction.md` when app-shell detected
- `audit-diff` — new hardcoded hex in CSS diff vs base branch

Add `--fail-warnings` to also block on `audit-ui.js` findings.

## Phase 5 — CI check

```
node "<SKILL_ROOT>/scripts/ci-check.js" --root . --base-url http://localhost:PORT --strict
```

## Phase 5b — Critique

Read `references/design-critique.md`. Run **after** ci-check, **before** telling the user the work is done:

```
node "<SKILL_ROOT>/scripts/design-critique.js" --root .
```

| Verdict | Meaning |
|---|---|
| **BLOCK** | Fix blockers before ship |
| **CONDITIONAL** | Warnings remain — fix or justify |
| **SHIP** | Deterministic gates clean |

Answer self-reflection prompts in your response:

1. Did Phase 2.5 match what was built?
2. Which audit findings remain and why?
3. Do screenshots match the brief?
4. What would a user notice in 5 seconds?
5. What would a senior designer block?

## Visual regression

```
cd "<SKILL_ROOT>/ab-harness" && npm install
node scripts/capture.mjs --app <dir> --base-url http://localhost:PORT --out artifacts/run
node scripts/compare.mjs --baseline artifacts/reference --candidate artifacts/run
```

## A/B harness

`SPEC.md` — fair skill vs no-skill comparison via `run-ab.mjs`.

## Composing with other tools

| Tool | Role |
|---|---|
| [Impeccable](https://impeccable.style) | Vocabulary + detect CLI — composes, does not replace layout/axe CI |
| Chromatic / Percy | Component visual approval |
| Lighthouse CI | Performance budgets |
| eslint-plugin-jsx-a11y | Static a11y lint |

This skill's CI focuses on **full-page apps** and **layout engineering** — extend with the above in mature design-system repos.
