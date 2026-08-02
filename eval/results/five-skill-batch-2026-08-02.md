# Five-skill forced-exposure batch — 2026-08-02

Five previously-untested skills, forced-exposure A/B, haiku-4.5 Task-tool
subagents, every outcome verified deterministically (mutants re-run, real
checkers re-run, Vale re-run, headings re-checked) — no self-reports
trusted. Per-run JSONs sit alongside this file (`batch5-*.json`). n is
small (1-2 per arm); treat these as first evidence, not laws.

| Skill | Result | Evidence |
|---|---|---|
| product-management | **POSITIVE** | Forced: exact `PRODUCT.md`, 5/5 required headings, + reply. Control: six ad-hoc docs (`product-brief.md`, `user-stories.md`, ...), zero required headings, nothing the acceptance gate can consume. The win is the interoperable artifact, not raw thinking quality — control did ask sensible questions in its own format. |
| engineering-assessment | **MIXED** | Forced: severity rubric, Unconfirmed section, explicit Coverage Gaps, 39 path citations, 126 tight lines — but found only 2/3 planted issues (missed the destructive migration entirely; never opened `migrations/`). Control: found 3/3 planted, but 296 rambling lines, no gaps statement, no unconfirmed split. The skill bought report discipline at the cost of coverage — the *opposite* trade the skill intends. |
| data-modeling | **NEGATIVE** | All four arms (control AND forced) produced migrations our own `check-migrations` BLOCKs — plain `DROP TABLE legacy_sessions` in an up migration; one forced arm even combined the DROP with the add in one file. The skill text did not transfer the additive-first rule under the bait "the table is no longer used by anything". Content defect, not eval noise. |
| testing-strategy | **NULL (ceiling)** | All four arms: baseline pass, 3/3 mutants killed. Haiku wrote 16-20 exhaustive tests for an 8-line pure function unprompted. Task too small to discriminate; needs a target where naive testing plausibly misses boundaries (stateful module, async, error paths). |
| ai-prose-slop | **NULL (design flaw, mine)** | Draft: CONDITIONAL, 10 Vale hits. All four edits: SHIP, 0 hits — control included. The control prompt said "make it read like a competent human wrote it", which IS the skill's goal; the objective leaked. Needs a neutral prompt ("tighten this draft") to discriminate. |

## What this changes

- Efficacy evidence now exists for 8 of 17 skills: 4 positive
  (systems-architecture, cli-tooling, product-build injection stance,
  product-management), 1 mixed (engineering-assessment), 1 negative
  (data-modeling), 2 null (testing-strategy, ai-prose-slop — both eval
  design limits, not skill verdicts).
- The negative and the mixed results are the valuable ones:
  - `data-modeling/SKILL.md` needs the additive-first rule stated as a
    hard rule with the observed rationalization countered ("the table is
    unused, so dropping it now is safe" — that is exactly when the DROP
    ships and breaks a lagging deploy).
  - `engineering-assessment` needs an explicit enumeration step ("list
    every directory before assessing; migrations and config are in
    scope") — its Coverage Gaps discipline worked, but discipline about
    gaps is not a substitute for not having them.
- Two ceilings are honest nulls: a strong-enough model does not need the
  skill for tiny tasks. Which is itself a scoping fact worth keeping: the
  skills earn their cost on tasks past the model's unprompted competence,
  and eval tasks must be sized there.
