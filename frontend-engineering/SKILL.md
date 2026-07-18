---
name: frontend-engineering
description: >-
  Choose and justify frontend stack from the job, scaffold maintainable structure,
  and enforce reuse/structure gates. Use on greenfield UI apps, unknown/vanilla
  profiles, monolith HTML/JS/CSS, dual frameworks or icon libraries, or when
  asking which framework/libraries/SDKs to use. Not for visual polish alone —
  compose with frontend-design after stack is locked.
---

# Frontend Engineering

Countermeasure for LLM structure failure: silent vanilla monoliths, dual stacks,
and React-by-habit. You pick the **right** stack for the job, confirm once, then
build modular structure. Visual craft is **frontend-design**; final product SHIP
is **product-acceptance**.

This skill is a **router**. Load only the references you need.

### Scripts

Resolve `<SKILL_ROOT>` to this directory:

```
node "<SKILL_ROOT>/scripts/profile-stack.js" [--root .]
node "<SKILL_ROOT>/scripts/check-structure.js" [--root .] [--strict]
```

## Operating principles

1. **Existing project wins.** Extend the framework, styling system, and icon set already in the repo. Never introduce a competing paradigm.
2. **No React monoculture.** Stack follows job + constraints (see `references/stack-selection.md`).
3. **No silent vanilla for app-tier.** Multi-view products are not single `index.html` + giant `app.js` unless the user explicitly chose a demo.
4. **Infer → propose one → confirm once.** Write `stack-decision.md` after confirmation.
5. **Structure matches complexity.** Property gates in `references/structure.md`.
6. **Reuse before invent.** One icon library, one CSS paradigm, prefer existing UI kit.
7. **Evergreen core.** Decision procedures and property gates live here; dated scaffold CLIs go in `recipes/`.

## Workflow

### Phase 0 — Profile

```
node "<SKILL_ROOT>/scripts/profile-stack.js"
```

Read `stack-profile.json`. Note `framework`, `scopeTier`, `needsStackInterview`, `smells`.

### Phase 1 — Stack lock (mandatory when interview needed)

If `needsStackInterview` is true OR framework is unknown/vanilla on **page/app** tier:

1. Read `references/stack-selection.md`
2. Infer job from PRODUCT.md / product-brief.md / user ask
3. Propose **one** primary stack + rationale (not a menu of five equals)
4. Confirm with the user once
5. Write `stack-decision.md` (see template in `templates/stack-decision.md`)

**Stop** before scaffolding UI if confirmation is pending.

If stack already exists and is coherent: write or update `stack-decision.md` as “existing — extend” and continue.

### Phase 2 — Structure

Read `references/structure.md`. Scaffold or refactor so modules match scope tier.
Do not start visual polish (frontend-design) until structure gates are green for app tier.

### Phase 3 — Structure verify

```
node "<SKILL_ROOT>/scripts/check-structure.js" --root . --strict
```

**BLOCK** on strict failures for app tier. Fix before claiming engineering done.

### Phase 4 — Hand off

- Multi-part system shape (client+server, trust) → **systems-architecture** (`ARCHITECTURE.md`) when missing
- Visual tokens / craft → **frontend-design**
- Flows / states → **frontend-ux** (or design interaction refs until carved)
- Outcome SHIP → **product-acceptance** (separate turn)

## References

| Topic | Read |
|---|---|
| Job → stack procedure | `references/stack-selection.md` |
| Structure property gates | `references/structure.md` |
| Dated scaffold notes | `recipes/2026.md` |

## Anti-patterns

| Wrong | Right |
|---|---|
| Default Vite+React+shadcn every time | Decide from job + constraints |
| “Unknown/vanilla — match it” on a new multi-tab app | Stack interview → confirm → scaffold |
| Lucide + Font Awesome + custom SVG soup | One icon system |
| 1500-line `app.js` + 1500-line `styles.css` for an app | Modules / components / views |
| Engineering self-SHIP of the product | product-acceptance in another turn |
