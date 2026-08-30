# Replacing preference with extraction: agreement goes 55% to 71-100%

The pairwise judge asked "which report is better" and three judges agreed with
each other 54-58% of the time over fifty pairs — near coin flips on a two-way
choice. An instrument that noisy cannot detect an effect of any size.

The diagnosis was the question, not the sample. "Better" is a preference.
`scripts/eval-rubric.mjs` asks instead for counts and facts a careful reader
should extract identically, one report at a time, with no sibling to compare
against.

## Agreement, measured before any comparison was reported

Sixteen reports, three judges each (haiku, sonnet, codex).

| item | all-3 agree | pairwise |
|---|---|---|
| longestFindingSupported | 16/16 | **100%** |
| statesScopeLimits | 12/16 | 83% |
| verdictStated | 12/16 | 83% |
| findingsWithFilePath | 11/16 | 79% |
| findingsWithLineOrOutput | 11/16 | 79% |
| findingsTotal | 9/16 | 71% |
| **scopeLimitsNamed** | 5/16 | **44%** |
| *(old holistic "which is better")* | — | *55%* |

Six of seven items beat the holistic question, four of them comfortably.

**`scopeLimitsNamed` is worse than what it replaced and is being dropped.**
Asking *how many* distinct scope-limit statements a report contains turns out
to be a judgement about where one statement ends and the next begins.
`statesScopeLimits` — does it name at least one — is the same information at
83% instead of 44%. Counting things whose boundaries are arguable reintroduces
exactly the subjectivity the rubric exists to remove.

`longestFindingSupported` agrees perfectly and is also useless here: every
report in the sample passed it. A ceiling item discriminates nothing, so it
stays only as a floor check.

## What the working instrument finds

Eight paired cases, consensus of three judges (median for counts, majority for
booleans):

| item | skill | policy |
|---|---|---|
| findings found | 4.38 | 5.00 |
| findings citing a file | 4.25 | 4.00 |
| findings citing a line or output | 3.63 | 3.63 |
| **states what it did not examine** | **6/8** | **2/8** |
| **states a verdict** | **8/8** | **5/8** |

No difference in how much is found or how well it is cited. A visible
difference in two things: admitting scope limits, and committing to a verdict.

Paired, discordant cases only:

    statesScopeLimits   skill-only 5, policy-only 1   one-sided P = 0.109
    verdictStated       skill-only 3, policy-only 0   one-sided P = 0.125

Neither clears 0.05 at eight pairs. **These are not results yet.** They are the
first signals this line of work has produced that point at something specific
rather than at length, and they are cheap to test properly: the same runs
already on disk support roughly fifty pairs.

## Why this is worth more than the holistic pass

The two items that move are the two the skills explicitly ask for. `Verdict`
and "state what you did not check" are literal requirements in
`product-acceptance`, and the honesty rule added to `release-engineering` on
2026-08-29 says the same thing. An instrument built without reference to those
rules, validated on agreement alone, lands on them.

That is a coherence check, not proof. The direction is what the skill text
predicts, and the effect is absent on dimensions the skill does not mention —
which is what a real effect looks like and what a length artefact does not.

## Standing caveats

- Eight pairs. Everything above is a pilot of the instrument.
- Three judges, two vendors. Agreement is measured, not assumed, but 83% still
  means roughly one report in six is scored differently.
- Extraction removes preference; it does not make the model a good reader.
  `findingsTotal` at 71% says the judges still disagree about what counts as
  one finding.

All rubric output is written `evidentiary: false` and none of it feeds
promotion.
