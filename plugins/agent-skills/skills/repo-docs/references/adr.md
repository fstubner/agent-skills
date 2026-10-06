# ADRs

An ADR records one decision that would be expensive to reverse, written when
it was made. The template belongs to the systems-architecture skill, which
decides when an ADR is needed. This skill checks the result.

## Where they go

`docs/adr/NNNN-short-title.md`, numbered in order. The checker also finds
ADRs in `docs/decisions/`, `doc/adr/`, `adr/` and `decisions/`. A `README.md`
or `index.md` in that folder is treated as an index, not an ADR.

## What `D-adr-structure` checks

Every ADR has a `**Status:**` field and these sections, each with real
content.

- **Context.** What was true when the decision was made, including what
  wasn't known yet.
- **Decision.** What was chosen, in one or two active sentences.
- **Consequences.** What it makes easier, what it makes harder and what it
  costs. Costs are required.
- **Alternatives rejected.** Each with the reason it lost.

## Rules

- Never edit an accepted ADR's decision. A changed decision is a new ADR
  whose Status supersedes the old one, and the old one's Status is updated to
  point at it.
- The date and status are fields in the template. Dates are expected in an
  ADR, so `D-history` doesn't apply.
- Bold field labels like `**Status:**` are the template's format and are
  exempt from the inline colon rule. The prose is not.
