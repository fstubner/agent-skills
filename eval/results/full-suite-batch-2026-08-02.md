# Full-suite forced-exposure batch — 2026-08-02

Completes efficacy coverage: every one of the 17 skills now has at least one
forced-exposure A/B data point. Haiku-4.5 Task-tool subagents, n=1 per arm,
outcomes verified deterministically where possible (checkers, mutants, Vale,
file/heading checks) and by manual read where grep was too crude — three
grep verdicts in this batch were wrong on first pass (nested output path,
flat filename, wording variance) and were re-scored by reading the actual
artifacts. Per-run JSONs: `batch6-*.json`.

## New results

| Skill | Result | Evidence |
|---|---|---|
| frontend | **STRONG POSITIVE** | Control: `index.html`+CSS+JS, zero artifacts, invented the whole visual direction silently. Forced: `design-direction.md` **with Interview section and ASSUMED entries** (the alpha.7 structural fix behaving as designed), tokens, ux-walkthrough, stack-decision — and it ran `check-frontend` itself: SHIP. |
| product-acceptance | **POSITIVE** | Control: unqualified SHIP, never ran the gate, pure prose. Forced: ran `accept-check`, applied the builder-context cap (CONDITIONAL), final verdict BLOCK with the gate report as evidence. |
| release-engineering | **POSITIVE** | Control: kept SSH+`git pull` deploy, no health check, no artifact discipline. Forced: test job gates deploy via `needs:`, post-deploy health poll, build-once, migrates off git-pull, rollback path. (Wrote the workflow to a flat filename — scored on content.) |
| code-organization | **POSITIVE** | Control: added a `services/` layer *inside* the framework buckets. Forced: "restructure from layers to domains", `domains/order-fulfillment/` with public-exports-only index — the skill's exact thesis, argued from the change-cost the fixture planted. |
| backend-engineering | **MODERATE POSITIVE** | Both arms validated at the boundary and returned structured errors (haiku baseline is decent). The lift is the flaky-wifi law: forced implemented real `Idempotency-Key` header handling; control mentioned duplicates but built no mechanism. |
| multi-agent-design | **WEAK POSITIVE** | Both arms pushed back on the 5-agent request (haiku is sensible unprompted). Forced added the formal delegation contracts and named coordination costs. |
| learn-from-session | **WEAK POSITIVE** | Both captured the date-format bug as a class with a regression-test suggestion. Forced additionally classified it per the skill's rules and routed it to a durable home (project CLAUDE.md/AGENTS.md convention) rather than wrap-up notes. |
| mental-models | **NULL (ceiling)** | Both arms found all 3 planted reasoning flaws, including the queue-removal coupling. Plan critique at this size is within haiku's unprompted competence. |
| code-smells | **NULL (ceiling)** | Both arms found all 4 planted smells AND explicitly spared the unusual-but-fine decoy. The judgment the skill encodes is already in the model at this scale. |
| testing-strategy | **NULL (replicated)** | Redesigned with a stateful async retry module and 4 mutants including error paths: both arms still killed 4/4. Two ceilings in a row on different task shapes. |
| ai-prose-slop | **NULL (replicated)** | Neutral prompt this time ("edit for publication" — no humanize hint): both arms still took the draft from 10 Vale hits to 0. The deterministic detector is the durable value; the editing guidance adds nothing a capable model doesn't do. |

## Retests after the alpha.9 skill fixes

- **engineering-assessment: FIXED.** With the mandatory enumeration step:
  3/3 planted issues found (the migration miss is gone) while keeping the
  rubric, Unconfirmed and Coverage Gaps discipline, at 139 lines.
- **data-modeling: PARTIALLY FIXED, new defect exposed.** The hard
  no-DROP-in-up rule now transfers: the drop was deferred with a
  deprecation-window note and a `+goose Down` marker instead of shipping as
  a live up-migration statement. But the arm still BLOCKs — on
  `DM-sql-unsafe-not-null`, because the skill's own prescribed sequence
  (add nullable → backfill → make required) ends in a bare
  `SET NOT NULL`, which the checker flags as a full-table-scan risk. **The
  skill and its checker currently disagree**: following the SKILL.md recipe
  produces SQL the checker blocks. Open defect — either the checker should
  accept plain `SET NOT NULL` (with backfill evidenced), or the skill must
  teach the `CHECK ... NOT VALID` → `VALIDATE` pattern. Not silently
  patched here; recorded for a deliberate decision.

## Where this leaves the suite

All 17 skills measured: 4 prior positives + 4-5 new positives, 2-3 weak
positives, 4 nulls (all ceilings — haiku already does these tasks well at
eval-task scale), 1 mixed→fixed, 1 negative→partially fixed with a named
open defect. The consistent pattern across every null: **a skill earns its
cost only past the model's unprompted competence.** Where the suite wraps a
deterministic artifact or gate (contract docs, acceptance, tokens,
checkers), lift is large and reproducible; where it restates judgment a
strong model already has (smell-spotting, plan critique, small-scale test
writing, prose editing), lift is zero at this scale. That is the honest
shape of the product: the artifacts and gates are the value; the judgment
prose is scaffolding around them.
