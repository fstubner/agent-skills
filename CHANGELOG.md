# Changelog

## 1.0.0-alpha.8 — 2026-08-01

**Two skills ported from dot-agents, which is now archived.** That repo was
an earlier attempt at the same problem — 26 skills, mostly sub-agent role
personas, no checkers, no tests, no eval data. Its two good ideas (the
.agents/ convention, cross-tool portability) were already absorbed here.
Of its content, two skills earned porting on substance:

-  — evidence-first codebase audit: every finding
  cites a file/line or command output, severity from a written rubric,
  and an explicit coverage-gaps section for what was NOT examined. Adapted
  to lean on this suite's own checkers as evidence sources where they apply.
-  — topology, delegation contracts, governance,
  failure recovery, with the honest first step: default to a single agent
  unless you can name the specific benefit.

Both are judgment-only and unevaluated, like 12 of the original 15 — the
same standard applies: no efficacy claim until a forced-exposure run
exists. The other 24 dot-agents skills were thin role prompts duplicating
checker-backed skills here, and were not ported.


## 1.0.0-alpha.7 — 2026-08-01

The audit release: every finding from the 10k-ft review, fixed in order.

- **CI ran for the first time.** The workflow triggered on main pushes and
  PRs only, so the entire v2 rebuild had never executed in CI — every
  'all tests pass' was one Windows machine. rebuild-v2 is now a trigger;
  first run green on Ubuntu and Windows both.
- **Telemetry moved to one user-level file**
  (~/.claude/agent-skills-telemetry/). v1 wrote .agent-skills-telemetry/
  into the cwd of every project the user touched — untracked litter in
  repos that never opted in. Rows already carried {project, cwd}, so
  nothing was lost by centralising.
- **concise-style is its own plugin.** Installing a skills library should
  not silently opt you into a global writing style; now it is a separate
  marketplace entry, independently installable and disable-able.
- **Packaging leak class closed.** A directory-source marketplace copies
  the working tree, gitignored files included — 645KB of session
  transcripts had shipped into the local plugin cache. The marketplace now
  installs from GitHub (tracked files only), which also exercised the
  remote-install path INSTALL.md documents; it worked, previously untested.
- **main fast-forwarded to the rebuild.** The default branch is no longer
  v0.4.0, which also retires 12 dependabot alerts against old fixture
  dependencies.


## 1.0.0-alpha.6 — 2026-07-31

**Canonical skill layout.** `templates/` renamed to `assets/` in frontend,
product-management and systems-architecture, matching Anthropic's skill
convention: `scripts/` executable, `references/` read for context, `assets/`
used in output. One documented exception — `ai-prose-slop/rules/` is Vale's
StylesPath layout, whose shape the tool dictates.

The rename passed the whole suite untouched, which was the real finding:
nothing verified that a path named in a SKILL.md exists, so a dead
instruction would have shipped silently. Now checked, along with the subdir
names themselves.

**Cross-tool entrypoints.** `AGENTS.md` holds the working instructions for
this repo and is tool-agnostic; `CLAUDE.md` is a pointer to it and is tested
to stay one. Two copies of the same guidance drift, and then whichever file a
tool happens to read decides which version is true.

INSTALL.md gains an honest portability matrix. Skills, checkers and the
pre-commit hook work on Claude Code, Codex, Cursor and Antigravity; the
plugin manifest and hooks are Claude Code only. Non-Claude users get the
response style by pointing their own always-on context file at
`output-style/concise.md` rather than copying it.

## 1.0.0-alpha.5 — 2026-07-31

**Response style, injected rather than suggested.** `output-style/concise.md`
sets a hard default of a few sentences, bans closing summaries and status
theatre, and matches structure to content instead of reaching for a table.

The mechanism is a SessionStart hook, chosen on evidence rather than
preference. A skill was wrong twice over: unprompted invocation measures at
~0%, and a rule governing every response has to be always-on rather than
opt-in. Claude Code's output-style feature is deprecated — Anthropic's own
explanatory-output-style plugin recreates it as a SessionStart hook, which
is also the proof this works: that hook demonstrably shaped a whole session's
output while installed skills did not.

Rules live in plain markdown so they stay readable by any tool; only the
injection is Claude Code specific.

## 1.0.0-alpha.4 — 2026-07-31

**One version, not two.** `plugin.json` deliberately omitted `version` so
every commit counted as a new one during active development — but that left
an installed plugin reporting a commit SHA while the repo reported
`1.0.0-alpha.3`, with no way for a user to tell which release they had.
The manifest now declares the version, and a test pins it to `VERSION`,
asserts the file is valid semver, and fails if either drifts.

**Skill usage is now readable, not just recorded.** alpha.3 shipped a
`PostToolUse` hook that writes invocations to a gitignored JSONL; nothing
read it back. `scripts/skill-usage.mjs` aggregates one or more logs into
per-skill and per-project counts — and, most usefully given that unprompted
invocation measured at ~0%, cross-references `registry.json` to list the
skills that have **never** fired. Reports invocation only; whether a skill
*helped* still needs the forced-exposure A/B protocol in `eval/`.

**Also:** `backend-block-secret` injects its fake key at test time instead
of committing one, so `gitleaks detect --no-git` reports no leaks on the
working tree and no fake key ships inside the plugin. The test gained a
control it could not previously express — the fixture must SHIP before
injection, pinning `B-client-secrets` as the reason for the block rather
than any other defect in the fixture.

## 1.0.0-alpha.3 — 2026-07-30

The release where the suite stopped guessing whether it works.

**First efficacy evidence — and the honest split it forces**

Two questions had been conflated: whether a skill gets *invoked*, and
whether its guidance *helps once followed*. They measure very differently,
so `eval/` now has two protocols and `eval-result.schema.json` a
`condition` field (`unprimed` | `forced`) to keep them apart.

- **Invocation: essentially never.** Two unprimed runs, all 15 skills
  installed from a tag, on a prompt matching `product-build`'s own trigger
  almost verbatim — no skill fired in either. Root-caused to the mechanism
  level: a competing plugin's far more aggressive approach (injecting a
  whole skill's text via `SessionStart`) didn't reliably fire either, so
  this isn't just weaker wording.
- **Efficacy: good, on the three skills tested.** Forced-exposure A/B,
  every verdict independently re-verified by re-running the checker rather
  than trusting the agent's self-report. `systems-architecture` 0/3 control
  vs 3/3 forced; `cli-tooling` 3/6 vs 5/6; `product-build`'s
  prompt-injection stance 2/4 vs 4/4. Three data points, not a general law
  — 12 skills remain untested this way.

README and INSTALL.md rewritten around that split, including the
`CLAUDE.md` directive that is the one mechanism observed to reliably change
behaviour here — labelled a workaround for a real limitation, not a feature.

**Enforcement instead of suggestion**

Where a check can be enforced rather than hoped for, it now is.
`code-smells` and `code-organization` gained `--files`, and the pre-commit
hook runs them on staged files with no model decision involved. Scoping is
load-bearing, not a convenience: a whole-repo scan blocks the first commit
on any codebase that isn't already green, and a hook that blocks unrelated
work gets bypassed. A cycle is graph-wide, so `code-organization` still
builds the full graph and scopes only the *reporting* — pre-existing cycles
are grandfathered, ones you introduce are not.

**Bugs found by dogfooding, not by looking**

- `classify.cjs` read only the ROOT `package.json`, so a genuine
  `backend/` + `frontend/` split with no workspaces field classified as
  single-part and the architecture gate said "not required". Found via a
  real eval run.
- `check-smells.js` violated its own nesting rule.
- The secret-scanner's own test tripped the secret scanner once extracted
  to a new file (whole content entered the staged diff for the first
  time). Fixed by assembling keys at runtime, not by allow-listing —
  which would have blunted the scanner to protect a test.

**Also**

- `run-tests.mjs`: 1320 lines → 40-line orchestrator + harness + 12
  modules. Verified behaviour-preserving by diffing output (507 unique
  assertions identical). The hook is now installed on this repo.
- Ships as a Claude Code plugin (`.claude-plugin/`), with a `PostToolUse`
  telemetry hook that logs skill invocations to a gitignored per-project
  JSONL — a hook rather than a skill, because a telemetry *skill* would
  inherit the exact selection bias being measured.
- Rationalization tables added to the four discipline-type skills, each
  countering observed failures (including the injection control's verbatim
  "if there's a real setup step required, I can run it now"). Whether they
  change behaviour is untested — a hypothesis, held to the same standard as
  everything else here.
- `systems-architecture` gained "system design" trigger vocabulary without
  widening its actual scope.

## 1.0.0-alpha.2 — 2026-07-26

**Behavioral eval, honestly reported**
- First real unprimed eval runs recorded (`eval/results/`, case `okr-tool`):
  both a Task-tool subagent and a genuine top-level `claude -p` session,
  with all 15 skills installed from tag `v1.0.0-alpha.1`, built the app
  without invoking a single skill — no `PRODUCT.md`, no `ARCHITECTURE.md`,
  no design question, same-turn self-certification of "done" in both. Root
  cause traced to the mechanism level: Claude Code's passive skill-listing
  discovery is weak, and even a plugin's hook-forced full-body injection
  (`superpowers`) didn't reliably produce invocation either, in an
  empirical A/B check run in the same environment. README and
  `eval/README.md` updated to state this plainly instead of the prior
  "zero recorded runs" scaffold language.
- Two more eval cases added (`csv-stats-cli`, `product-doc-injection`),
  bringing total case count to 3 per Anthropic's own "at least three
  evaluations" authoring checklist; neither has recorded runs yet.

**Spec-compliance pass (agentskills.io/specification + Anthropic's official
skill-authoring guide)**
- `product-build` and `product-acceptance` descriptions rewritten to drop
  internal-mechanism summaries ("checks sibling triggers and hands off...",
  "verifies... re-runs... walks...") per a documented, tested failure mode:
  a description that summarizes a skill's workflow lets a model mimic an
  abbreviated version of it without ever loading the real content.
- `mental-models/SKILL.md` cut from 1286 to 781 words by moving the
  Mindsets section to `references/mindsets.md`, extending the same
  progressive-disclosure pattern the Lenses section already used.
- Added a compatibility field (Node 18+, plus Vale/gitleaks where relevant)
  to the 8 skills with executable checker scripts.
- Added a table of contents to the two reference files over 100 lines
  (`ai-prose-slop/references/patterns.md`, `code-smells/references/catalog.md`).
- Piloted an experimental `allowed-tools` field on `backend-engineering` and
  `frontend`, scoped to their own checker scripts plus read-only
  exploration tools, to test whether it reduces permission friction.
- Fixed `mental-models/SKILL.md` calling Cynefin's domains
  "fault-categories" — not Cynefin's actual terminology.

## 1.0.0-alpha.1 — 2026-07-25

Ground-up rebuild, promoted to the repository root. Supersedes the 0.x line
(tagged `v0.4.0`) after a six-perspective audit of 0.4.0; the architecture
inverts where 0.x put trust. This entry is amended in place rather than
appended to — nothing under this version has been tagged yet, so there is
no released state it would be rewriting.

**Contract and acceptance**
- **registry.json** is the single machine-readable contract (skills +
  artifacts + producers + consumers); `docs/CONTRACT.md` is generated from
  it and CI fails on drift.
- **Acceptance re-runs checkers** instead of reading report JSONs — stale,
  hand-edited, or repo-planted reports can no longer influence a verdict,
  the 0.4 bug where `backend-report.json` was produced but never consumed
  is structurally impossible (regression-tested), and acceptance now
  recomputes each producer's verdict from its own checks rather than
  trusting a `verdict` field the producer wrote about itself.
- **One check shape** (`id`/`status`/`detail`, `not_evaluated` ≠ `pass`),
  one verdict rule, one report schema, one project classifier.
- **Fail-closed gates**: crashed producers are failures; unknown schema
  keywords throw; token files without required text tokens fail contrast;
  an unreadable `--root` and an empty `checks` array are never a pass.

**Skills: 8 → 15**
- 0.4.0's 8 skills consolidated to 6 + 1 standalone (frontend-engineering,
  frontend-design, and frontend-ux merged into `frontend`; `build` renamed
  `product-build`; `anti-ai-slop` joined as a standalone Vale-backed prose
  skill, later renamed `ai-prose-slop`).
- Added `mental-models` (reasoning-lens catalog, four named mindsets —
  Skeptic, Systems Thinker, Pragmatist, Explorer — merged in as a section
  rather than four separate skills once each one's own text admitted it
  had no mechanics beyond a persona wrapped around a shared lens),
  `code-smells`, `code-organization`, `testing-strategy`, `data-modeling`,
  `cli-tooling`, `release-engineering`, `learn-from-session`.
- Five of those get a real deterministic checker for the one slice of their
  judgment domain that's genuinely checkable without a per-project parser:
  circular imports (`code-organization`), file size and brace-language
  nesting depth (`code-smells`), destructive SQL migrations
  (`data-modeling`, prefixed `DM-sql-` so it's never mistaken for having
  evaluated data modeling generally) — plus the pre-existing architecture,
  frontend, and backend checkers.
- The project classifier (`core/lib/classify.cjs`) recognizes seven
  ecosystems (Node, Python, Go, Ruby, Java, Rust, PHP), not just Node —
  a Django, Gin, Rails, Spring Boot, Actix, or Laravel backend is now
  correctly detected instead of silently reading as "no server."

**Secret scanning**
- Replaced a hand-rolled 6-pattern secret list with
  [`gitleaks`](https://github.com/gitleaks/gitleaks) — a real, maintained
  tool, shelled out to rather than reimplemented, the same choice already
  made for Vale. A small supplementary ruleset (`core/gitleaks-extra.toml`)
  covers two provider key formats gitleaks' defaults don't, carrying a
  length floor, an entropy floor, and a placeholder allowlist so
  documentation showing a key's *format* isn't reported as a leak.
- The audited repo cannot disable its own scan: gitleaks' configuration is
  supplied explicitly rather than auto-discovered from the tree being
  scanned, closing a real hole where a planted `.gitleaks.toml` or an
  inline `gitleaks:allow` comment could switch off `product-acceptance`'s
  check on the untrusted repo it's meant to audit. An opt-in pre-commit
  hook (`git config core.hooksPath scripts/git-hooks`) shares the same
  detection.

**Installer and CI**
- No default target, marker-file ownership before any delete, src==dest
  guard, `--help`; the entire `core/` directory is vendored wholesale for
  standalone installs (not enumerated by subdirectory — that enumeration
  once silently dropped a new file and made every installed check-backend
  run fail unconditionally).
- Windows is a first-class platform: `.gitattributes`, CRLF-normalized
  reads everywhere, CI matrix includes `windows-latest`.
- CI lives at the repository root (`.github/workflows/ci.yml`) — a prior
  copy nested inside this directory before promotion had never run once,
  since GitHub Actions only reads workflows from the repo root.

**Honesty**
- The eval is labeled a scaffold with zero runs; a saved result is now
  actually schema-validated by the test suite rather than merely
  documented as such.
- Prompt-injection stance stated once in the generated contract and echoed
  by every skill that reads project documents; the README no longer hands
  out `product-acceptance`'s uncapped command unconditionally, which had
  directly contradicted this suite's own "builder ≠ acceptor" claim.
- An external adversarial review (code, tests, and content, independently)
  found and fixed a working install that was unconditionally broken, six
  silently-unsupported manifest formats, a mutation-tested test suite where
  every threshold was previously a free parameter, and several skill-level
  contradictions and citation overclaims. Documented in the commit history
  rather than repeated here in full.
