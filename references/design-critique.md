# Phase 5b — Adversarial Design Critique

Deterministic audits catch slop and breakage. **Critique** catches mediocrity — hierarchy that
works but doesn't sing, craft that's correct but generic.

**Rule:** The agent that built the UI must not run critique in the same breath as "done."
Assume the output is mediocre until critique proves otherwise.

## When to run

- Full pages before ship
- After `ci-check` passes (or PASS_WITH_WARNINGS with justified findings)
- When the user asks "does this look good?" — never answer from builder memory alone

## Specialist passes (run all)

Each specialist is **adversarial** — find problems, not praise.

| Specialist | Question | Sources |
|---|---|---|
| **Intent & originality** | Could this be any SaaS template? What's the one deliberate craft move? | `visual-direction.md`, `audit-generic.js`, `product-brief.md` |
| **Typography** | Three hierarchy levels at arm's length? Web fonts loaded? | `typography.md`, screenshot |
| **Color & surfaces** | Chrome ≠ content? Accent in ≥2 roles? Contrast tool pass? | `color.md`, `check-tokens-contrast.js` |
| **Layout & rhythm** | Viewport shell correct? Spacing from tokens? Patch CSS smell? **No horizontal overflow at 390px?** | `layout-check`, `responsive-design.md`, `regression-guardrails.md`, `audit-ui.js` |
| **Interaction & states** | Loading, empty, error, success? Feedback immediate? **Obvious primary action on each list page?** | `interaction.md`, `sane-defaults.md` |
| **Accessibility** | axe zero serious? Focus visible? Semantics? | `axe-check.mjs`, `accessibility.md` |

## Boss synthesis — verdict

| Verdict | Criteria |
|---|---|
| **BLOCK** | Contrast fail, axe serious violations, layout fail, generic score >2, or no direction lock on full page |
| **CONDITIONAL** | PASS_WITH_WARNINGS — fix listed items or justify in report |
| **SHIP** | All block gates pass; critique findings addressed or accepted by user |

Run the aggregator:

```
node "<SKILL_ROOT>/scripts/design-critique.js" --root . [--ui-check-report ui-check-report.json]
```

Read `design-critique-report.json`. Include verdict + top 3 fixes in your response.

## Agent critique prompts (if no script)

Answer in writing, with screenshot if available:

1. **5-second test:** What is this page? What action is obvious?
2. **Generic test:** Name three tells that scream "AI template." How would Phase 2.5 fix them?
3. **Hierarchy test:** Squint — are there exactly three text levels, or a wall of sameness?
4. **Regression test:** What breaks on tablet? What breaks if the sidebar uses sticky in flow?
5. **Ship test:** What would a senior designer block in review?

## Calibrated judgment

LLM self-critique skews positive. Prefer:

- Deterministic gates first (contrast, axe, layout, generic score)
- Screenshot compare against baseline
- Human review for visual diffs on fragile surfaces

See `verification.md` release gates.
