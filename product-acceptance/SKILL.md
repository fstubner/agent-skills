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

### Scripts (verification — evidence for self-correction)

```
node "<SUITE_ROOT>/_suite/scripts/classify-project.js" --root .
node "<SKILL_ROOT>/scripts/accept-check.js" --root . --strict --acceptor-context separate
```

`<SUITE_ROOT>` is the agent-skills repo root (parent of this skill when installed from the monorepo).

Check statuses: `pass` | `fail` | `not_evaluated`. Notes do not force CONDITIONAL.  
Use `--acceptor-context separate` on a true acceptance turn; `same` → **BLOCK**; `unknown` (default) is a note only.

## Hard rules

1. **Builder ≠ acceptor.** Do not final-SHIP in the implementing turn. Prefer a separate turn with `--acceptor-context separate`.
2. **App tier needs a product contract.** Missing `PRODUCT.md` and `product-brief.md` → **BLOCK**.
3. **Evidence required.** Cite reports / walkthrough / file:line. Missing required evidence is `not_evaluated` or WARN — never fake `pass`.
4. **Visual SHIP ≠ product SHIP.**
5. **Architecture report BLOCK** on multi-part → product **BLOCK**.

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
