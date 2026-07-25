# Changelog

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
