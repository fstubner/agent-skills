---
name: product-acceptance
description: >-
  Adversarial product acceptance review against PRODUCT.md / product brief.
  Use when asking whether work is done, ready to ship, meets the brief, or needs
  QA/acceptance. Issues SHIP / CONDITIONAL / BLOCK for product outcome — not
  visual taste alone. Builder must not self-pass in the same turn.
---

# Product Acceptance

Countermeasure for LLM self-grading. You attack the **outcome vs brief**, consume
evidence from other skills, and refuse SHIP when the primary job is not real.

Shared vocabulary: `../_suite-charters/SHARED_CONTRACT.md` (or suite charters).

### Scripts

```
node "<SKILL_ROOT>/scripts/accept-check.js" [--root .] [--strict]
```

## Hard rules

1. **Builder ≠ acceptor.** If this conversation just implemented the feature, do not issue final SHIP here — stop and require a separate acceptance turn/subagent, or run only `accept-check.js` and leave verdict for a fresh pass.
2. **App tier needs a product contract.** Missing `PRODUCT.md` and `product-brief.md` → **BLOCK**.
3. **Evidence required.** Cite eng-structure-report, architecture-report, design-critique-report, walkthrough steps, or file:line. “Looks done” is invalid.
4. **Visual SHIP ≠ product SHIP.** Design-critique SHIP with a missed JTBD is still BLOCK.
5. **Multi-part systems:** architecture-report BLOCK → product **BLOCK** (boundaries/trust are outcome risks).

## Workflow

### 1. Load contract

Read `PRODUCT.md` or `product-brief.md`. If missing on app/page product work:

- Offer template from `templates/PRODUCT.md`
- Interview minimum fields (register, users, purpose, success, MVP, anti-goals)
- **BLOCK** acceptance until written

### 2. Run deterministic precheck

```
node "<SKILL_ROOT>/scripts/accept-check.js" --root . --strict
```

### 3. Adversarial review

Read `references/adversarial-checklist.md`. For each theme, pass/fail with evidence.

### 4. Verdict

Write `product-acceptance-report.json` via the script (and summarize in chat):

| Verdict | When |
|---|---|
| **SHIP** | Contract present; primary job evidenced; no blockers |
| **CONDITIONAL** | Soft gaps / warnings only |
| **BLOCK** | Missing contract, failed primary job, eng BLOCK, or demo-ware |

## Does not own

- Choosing frameworks (frontend-engineering)
- Token aesthetics (frontend-design)
- Implementing fixes (hand back to builder with blockers listed)
