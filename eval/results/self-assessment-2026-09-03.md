# Engineering assessment of agent-skills, by its own engineering-assessment skill

Date: 2026-09-03. Depth: **targeted** on the engineering code; the skill
prose, fixtures and run bundles are out of scope except where a tool reported
on them.

## Scope

In scope, read or tool-checked: `scripts/` (25 files, 4130 lines),
`scripts/tests/` (30 files, 4540 lines), `core/lib/`, `skills/*/scripts/`
(11 checkers, 2622 lines), `eval/graders-v2/` (65 graders, 6639 lines),
`.github/workflows/`, `registry.json`, `.gitattributes`, `.gitignore`,
`CHANGELOG.md`.

Out of scope: the 17 `SKILL.md` texts and their references (prose, not
code); `eval/fixtures-v2/` and `eval/runs/**/outputs/` (adversarial fixtures
and model output, deliberately defective); `plugins/` (generated, drift-tested
by `plugin-bundles.mjs`); `tooling/runtime-smoke/node_modules`.

## Environment

Node ≥ 22 (CI pins 22), ES modules, **zero runtime dependencies** — there is
no `package.json` at the root. Domain: a skills suite for four coding
harnesses plus a controlled-evaluation system. CI: GitHub Actions on
`ubuntu-latest` and `windows-latest` (`ci.yml:21`), plus release,
runtime-smoke and standards-drift workflows.

## What I ran

| command | result |
|---|---|
| `npm test` | **failed to start**: `ENOENT ... package.json`. There is no npm surface; the declared runner is `node scripts/run-tests.mjs` (`AGENTS.md:25`). |
| `npm audit` | **failed to start**: `ENOLOCK`. Nothing to audit — no dependencies. |
| `node scripts/run-tests.mjs` | 2252 ok, then **FAIL** `v2 evaluation evidence verifies — eval/runs/health-check-always-ok-claude-code-policy-20260902231409-ce80f3: missing run.json`, and 7 dependent failures. A haiku batch was writing that bundle at the time. Earlier today, with no batch running, the same suite passed at 2474 checks. |
| `node scripts/gen-contract.mjs --check` | `docs/CONTRACT.md matches registry.json` |
| `node --check` on every `.mjs/.js/.cjs` in scope | 0 syntax failures |
| `check-organization.js --root .` | **BLOCK**: `O-circular-deps` in `eval/fixtures-v2/account-suspension-boundary/` — a planted defect, not the suite's code |
| `check-smells.js --root .` | **BLOCK**: `S-large-file` on `core/lib/classify.cjs` (553 lines) and four minified graders; `S-deep-nesting` in a model-written `eval/runs/.../smoke-test.js` |
| both checkers on `scripts`, `skills`, `hooks`, `tooling`, `routing` individually | **SHIP** on every one |
| `check-smells.js --root core` | **BLOCK**: `classify.cjs` 553 lines |
| `check-smells.js --root eval/graders-v2` | **BLOCK**: four graders with a 1460–1716-character line 2 |

## Findings

| # | Sev | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Reliability | The test suite cannot run while an eval batch is running. `eval-verify` fails on a bundle whose `run.json` has not landed, and 7 tests that assert "verify passes" fail with it. | `audit-suite.txt`: `FAIL ... missing run.json` at 2252 checks; `scripts/eval-verify.mjs:70` fails on any directory without `run.json`. The batch chains I ran today committed on verify-pass, so a batch running during another batch's commit step would have blocked it. | Have `eval-run.mjs` build the bundle in a staging name (`.<runId>.partial`) and rename on completion; `eval-verify` then never sees a half-written bundle. One rename, one line in verify to skip `.partial`. |
| 2 | High | Maintainability | Four graders are minified single-line source with no readable original anywhere in the tree. A grader is the instrument every verdict depends on; these cannot be read, reviewed, or diffed. | `eval/graders-v2/{receipt-upload-interview-gate,scheduled-report-design-gate,stale-pass-review,ticket-attachment-boundaries}.mjs`: 2 lines each, line 2 is 1460–1716 chars. Introduced in `2bf2e58` (2026-08-16). | Reformat them to the style of the other 61 (any formatter will do), bump nothing — the grader hash changes, so their runs supersede; `stale-pass-review` has 6 bound bundles, the others none on the current matrix. Do it before the codex arm. |
| 3 | Medium | Maintainability | The citation matcher is copied into 23 graders and the `--root` boilerplate into all 65. Three separate sweeps were needed to fix one matcher; each missed some copies; 185 runs were superseded across them. | `grep -l "const citedSpans" eval/graders-v2/*.mjs` → 23; `process.argv.indexOf('--root')` → 65. Commits `6e0e8d0`, `b97d496`, superseded README entries dated 2026-09-01. | Extract `eval/graders-v2/lib/citation.mjs` and `lib/grader-io.mjs`. `graderSha256` must then cover the imported files — hash the grader plus its local imports, which `eval-run.mjs:369` does not do today. That is the real reason the duplication exists; solve the hashing and the duplication goes. |
| 4 | Medium | Maintainability | The suite's core library violates the suite's own rule. `S-large-file` (>400 lines) is the rule `check-smells` enforces on user projects; `core/lib/classify.cjs` is 553 lines. | `check-smells.js --root core` → BLOCK. The largest function is `classify` at 61 lines; the file is 17 top-level functions. | Split by manifest family (npm / cargo / pyproject / ...), which is how the tests in `scripts/tests/classify.mjs` are already organised. |
| 5 | Medium | Tooling | The checkers cannot exclude a directory, so run on this repository they BLOCK on planted fixture defects and model-written output. The suite cannot use its own gate on itself in CI. | `check-organization.js --root .` BLOCK on `eval/fixtures-v2/...`; `check-smells.js --root .` cites `eval/runs/.../outputs/src/server.js`. No `--exclude` in either script's arg parsing. | Add `--exclude <glob>` (repeatable) to the shared walker in `core/`, and run both checkers on `.` with `--exclude eval/fixtures-v2 --exclude eval/runs*` in `ci.yml`. Finding 4 would then have been caught by CI, not by this audit. |
| 6 | Medium | Test coverage | 7 of 25 scripts have no test that names them. Two of them (`eval-power.mjs`, `eval-rubric.mjs`) produce numbers the evidence contract reads. | `grep -rqF <name> scripts/tests/` misses: `eval-assertion-rollup`, `eval-import-projectless`, `eval-power`, `eval-projectless-prompt`, `eval-rubric`, `inject-routing`, `skill-outcomes`. | `eval-power` first: it computes the minimum detectable effect the promotion contract cites. One test with a known SD and n pinning the answer. `skill-outcomes` (mine, today) next. |
| 7 | Medium | Process | 94 commits since the alpha.22 release and the CHANGELOG has no `[Unreleased]` section. The repository's own release rule says finished work accumulates there. (First written as "111 since the last tag": local tags stop at alpha.13, but `VERSION` and the CHANGELOG are at alpha.22, dated 2026-08-17.) | `VERSION` → `1.0.0-alpha.22`; `git log --since=2026-08-17 | wc -l` → 94; `grep '\[Unreleased\]' CHANGELOG.md` → nothing. | Write the section now from `git log`. It is a day's work to reconstruct and grows with every commit skipped. |
| 8 | Low | Reliability | 12 catch blocks are empty with no comment; the other 42 silent catches each say what the absence means. | `grep -E "catch\s*\{\s*\}"` → 12, e.g. `scripts/verify-installed-package.mjs:40`. | Add the one-line reason to each, matching the convention the other 42 follow. |
| 9 | Info | Reliability | The batch runner counted 158 empty (429) bundles as completed trials and reported the claude-code arm complete. Fixed today in `3c7d30c` with a test that fails on the old rule. Recorded here because it is the same class as finding 1: tooling that reports a state it did not verify. | `3c7d30c`; `scripts/tests/eval-batch.mjs`. | Done. |
| 10 | Info | Repository | 9916 tracked files and 702 transcripts under `eval/runs`; the working tree is 341 MB and the pack 6.9 MB. Manageable now; the codex arm adds ~400 bundles. | `git ls-files eval/runs | wc -l`; `du -sh`; `git count-objects -vH`. | No action yet. Revisit at the next arm. |

## Unconfirmed

- 65 tracked files have CRLF endings despite `* text=auto eol=lf`. They are
  probably model-written `outputs/` under `eval/runs`, where the model chose
  the endings, and are harmless there; not confirmed which files.
- Whether the minified graders (finding 2) behave identically to what their
  author intended cannot be checked without the source they were built from.
  They pass their own fixture tests, which is all that can be said.

## Summary

### Strengths

- **Evidence is hash-bound and the binding is tested by sabotage.** Every run
  records the case, fixture, grader and checker digests; `eval-verify` refuses
  a mismatch; and the tests that prove that were shown to fail when the check
  is disabled (`scripts/tests/eval-fixture-binding.mjs`, verified today).
- **Zero runtime dependencies, CI on both platforms, 2474 checks.** Nothing to
  audit, nothing to drift, and the suite has caught real defects on Windows
  that Linux would have hidden (CRLF fixtures, `cmd.exe` spawning).
- **The record is honest.** Every instrument defect found this week is in a
  commit message with the measurement that found it and the count of runs it
  cost. The superseded-runs README explains each supersession. This is rarer
  than the code quality.
- **The checkers are tested against ship and block fixtures**, and the
  registry→contract generation fails CI on drift (`gen-contract --check`).

### Key risks

- **The instrument is duplicated and partly unreadable** (2, 3). Sixty-five
  graders are the whole basis for any efficacy claim. Twenty-three carry a
  copy of the same matcher, four cannot be read at all, and the hashing scheme
  is what forces the copying. Three sweeps and 185 superseded runs is the
  measured cost so far.
- **The suite does not pass its own rules** (4, 5). Its checkers BLOCK its own
  repository, partly on real defects and partly because they cannot skip
  fixture trees. A suite that gates other people's code should gate its own
  in CI.
- **Verification and evidence collection collide** (1). The test suite and a
  running batch cannot coexist. Today that cost one spurious red run; on the
  wrong afternoon it blocks a commit that should land.

### Priority order

1. Finding 1 — staged bundle names. Small, and it unblocks running tests
   during the codex arm.
2. Finding 2 — reformat the four minified graders before any more runs bind
   to them.
3. Finding 5 — `--exclude` on the checkers, then run them on this repo in CI.
4. Finding 3 — extract the shared grader library once `graderSha256` covers
   imports. Larger; do it between arms, not during one.
5. Findings 4, 6, 7 — split `classify.cjs`, test `eval-power`, write the
   changelog. Ordinary hygiene, in that order.

### Coverage gaps

- The 17 skill texts were not assessed. Their quality is what the eval
  programme measures; this audit is about the engineering around it.
- `eval/fixtures-v2` and run outputs were not read; they are supposed to be
  defective.
- No performance assessment. The suite runs in about ten minutes; nothing
  suggested it needed one.
- `npm audit` could not run and there is nothing for it to audit. Whether
  `tooling/runtime-smoke/node_modules` (a gemini-cli install) is pinned and
  current was not checked.
- The codex container path (`--codex-container`, Docker) was not exercised.
- No security review beyond confirming the pre-commit gitleaks hook and its
  tests; the suite handles no user data and runs no network service.

## Is it a professional product with engineering rigour?

On process, yes, and unusually so: hash-bound evidence, sabotage-verified
tests, both platforms in CI, and a written record that says what broke and
what it cost. On the hygiene of its own code, not yet: it fails its own
checkers, four of its instruments are unreadable, and the shared logic every
verdict depends on is copy-pasted 23 times because the hashing design makes
sharing hard. None of those is large. All of them are the kind of thing a
stranger opening the repository would find in the first hour, which is the
test that matters for something shared publicly.
