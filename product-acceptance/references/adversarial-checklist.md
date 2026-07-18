# Adversarial acceptance checklist

Assume the build is a convincing demo until evidence proves otherwise.

## A. Contract

| Check | BLOCK if |
|---|---|
| PRODUCT.md or product-brief.md exists | App-tier work without either |
| Users + purpose + success stated | Hollow “enterprise platform” fluff only |
| MVP and anti-goals present | Scope unbounded |

## B. Primary job

| Check | BLOCK if |
|---|---|
| Primary job named in one sentence | Cannot state JTBD |
| Happy path steps listed | Vague “user can manage data” |
| Path completable in the build | Critical step missing, stubbed, or dead control |
| Empty / error / success considered | Only happy-path fake data |

## C. Honesty vs demo-ware

| Check | BLOCK if |
|---|---|
| Real or honest mock boundary | Fake metrics presented as live without label |
| Empty states exist for collections | Tables only work with seeded JSON |
| Destructive actions confirm | Delete/pay with no confirm |

## D. Cross-skill evidence (consume, don’t redo)

| Evidence file | Expectation |
|---|---|
| `eng-structure-report.json` | Not BLOCK for app tier (or justified throwaway) |
| `architecture-report.json` | Not BLOCK for multi/distributed systems |
| `ARCHITECTURE.md` | Present when client+server (or core third-party path) |
| `stack-decision.md` | Present when stack was greenfield/unknown |
| `design-critique-report.json` | Not BLOCK if visual work claimed done |
| UX walkthrough notes | Primary path steps checked |

Missing eng report on app tier → **CONDITIONAL** at best; prefer running frontend-engineering `check-structure.js` first.  
Missing architecture report on multi-part systems → warn or BLOCK via accept-check when architecture verdict is BLOCK.

## E. Self-grade

| Check | BLOCK if |
|---|---|
| Acceptor ≠ sole builder of this change | Same turn implemented and SHIPped without separate pass |

## Output shape

For each failed check: `id`, `severity`, `evidence` (or `missing-evidence`), `fix-hint`.
