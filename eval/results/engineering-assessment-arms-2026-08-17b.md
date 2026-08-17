# Four arms, all 2/5 — and the one thing that moved is invisible to the score

Retry after the first subagent attempt, with a hardened scope preamble
naming the six fixture files and forbidding anything under `H:\projects`.
Supersedes the isolation conclusion in
[subagent-arms-2026-08-17.md](./subagent-arms-2026-08-17.md).

## Scope held this time

| Arm | Fixture citations | References to this repo | In scope? |
|---|---|---|---|
| policy (retry) | 6 | 0 | yes |
| skill (trial 2) | 9 | 0 | yes |

The earlier policy arm assessed this repository instead of the fixture. With
the file list stated explicitly, both retries stayed in the fixture. So
prompt hardening does work — but note what that sentence hides: scope was
still established *after the fact*, by counting citations in the output. The
CLI harness does not need that check, because a copied workspace and a
`--cd` flag make wandering impossible rather than unlikely.

## Every arm scored 2 of 5

| Arm | Harness / model | Score | planted-risks citations |
|---|---|---|---|
| control | codex gpt-5.6-luna, container | 2/5 | **0 of 3** |
| policy | haiku subagent | 2/5 | **0 of 3** |
| skill, trial 1 | haiku subagent | 2/5 | **2 of 3** |
| skill, trial 2 | haiku subagent | 2/5 | **2 of 3** |

Control and policy passed the same two assertions (`false-green-detected`,
`tooling-evidence`). Skill trial 2 passed those same two; skill trial 1
passed the other pair (`ranked-actionable-findings`, `coverage-honesty`).
So *which* two pass is unstable across trials, and the total never moves.

## The finding is about the case, not the skill

One measure separates the conditions cleanly and reproduces across both
skill trials: the skill arms cite 2 of the 3 planted risks with valid
file-and-line evidence, where control and policy cite **none**. That is the
assessment skill's central rule — every finding carries a citation a reader
can check — and it is exactly what changed.

The score cannot see it. `planted-risks-cited` is all-or-nothing across
three risks, so 0 of 3 and 2 of 3 are both simply "fail". **A case whose
only discriminating measure is buried inside a failing assertion cannot
detect the improvement it was built to measure.**

The fix is to split that assertion into one per planted risk, or have it
report partial credit. I have not made that change: editing the case alters
its `caseSha256`, which by design invalidates the one real v2 bundle we
have — the control run. That is a deliberate trade the case owner should
make knowingly, not a tidy-up.

## What this is not

Four runs, three of them on a different harness and model from the one real
bundle, one trial each for control and policy. Nothing here meets the
promotion bar and nothing here says the skill works. It says the case in its
current form would report "no difference" even in the run where the skill
demonstrably changed the output.
