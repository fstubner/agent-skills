# Product

## Purpose

Help software teams give coding agents reusable, portable guidance backed by deterministic checks and auditable evidence.

## Users

- **Primary:** Developers and product teams using Claude Code, Codex, Cursor, or Antigravity on software projects.
- **Context:** Teams need guidance that can be installed selectively, checked mechanically where possible, and evaluated without confusing invocation with efficacy.

## Success

- A developer can install a registered skill into a supported harness and use its documented workflow without depending on this source checkout.
- A reviewer can reproduce checker and acceptance verdicts from repository fixtures and recorded evaluation bundles.
- A maintainer can determine separately whether a skill was invoked and whether it improved task outcomes.

## MVP

- Maintain 17 independently triggered skills in the registry-first contract.
- Install any selected subset into Claude Code, Codex, Cursor, or Antigravity without network access or unowned-directory replacement.
- Provide deterministic checkers and schema-valid reports for rules that can be mechanically enforced.
- Re-run applicable domain checks through an acceptance gate that does not trust stale report files and does not let builders self-certify.
- Record invocation telemetry and isolated evaluation evidence without making unsupported behavioural claims.

## Anti-goals

- Guarantee that a harness will invoke a skill without measured evidence.
- Claim that skill guidance improves output quality or cost without reproducible comparative runs.
- Replace project-specific product, design, architecture, or security decisions with generic defaults.
- Operate a hosted agent platform or require a hosted service.

## Constraints

- `registry.json` is the machine-readable source of truth for skills, artifacts, acceptance gates, and harness installation paths.
- Installation requires Node.js 18 or newer, performs no network access, and must preserve directories the installer does not own.
- The suite remains portable across Claude Code, Codex, Cursor, and Antigravity; harness-specific hooks must be identified as such.
- Invocation and efficacy are measured and reported separately; unsupported behavioural claims are prohibited.
- Acceptance is independent: the context that built a change cannot issue an uncapped SHIP verdict for it.

## Acceptance

- [ ] Registry, generated contract, version, changelog, and plugin metadata agree.
- [ ] The full fixture and mutation test suite passes on Windows and Ubuntu.
- [ ] Every effectiveness claim cites reproducible evidence under `eval/`.
- [ ] Installation tests prove ownership safety, standalone skill operation, and canonical per-harness placement.
