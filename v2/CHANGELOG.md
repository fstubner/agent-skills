# Changelog

## 1.0.0-alpha.1 — 2026-07-23

Ground-up rebuild. Supersedes the 0.x line after a six-perspective audit of
0.4.0; the architecture inverts where 0.x put trust.

- **registry.json** is the single machine-readable contract (skills +
  artifacts + producers + consumers); `docs/CONTRACT.md` is generated from
  it and CI fails on drift.
- **Acceptance re-runs checkers** instead of reading report JSONs — stale,
  hand-edited, or repo-planted reports can no longer influence a verdict,
  and the 0.4 bug where `backend-report.json` was produced but never
  consumed is structurally impossible (regression-tested).
- **One check shape** (`id`/`status`/`detail`, `not_evaluated` ≠ `pass`),
  one verdict rule, one report schema, one project classifier.
- **Fail-closed gates**: crashed producers are failures; unknown schema
  keywords throw; token files without required text tokens fail contrast.
- **Skills consolidated 8 → 6 + 1 standalone**: frontend-engineering,
  frontend-design, and frontend-ux merged into `frontend` (UX now owns a
  checkable artifact, `ux-walkthrough.md`); `build` renamed `product-build`
  with "ship this" routing moved to product-acceptance; **anti-ai-slop**
  joins as a standalone Vale-backed prose skill (its checker converted to
  CJS and the unified report shape).
- **Safe installer**: no default target, marker-file ownership before any
  delete, src==dest guard, vendored core for standalone installs, `--help`.
- **Windows is a first-class platform**: `.gitattributes`, CRLF-normalized
  reads everywhere, CI matrix includes `windows-latest`.
- **Honest claims**: the eval is labeled a scaffold with zero runs; the
  README's claims section is scoped to what the fixtures actually prove.
- Prompt-injection stance stated once in the generated contract and echoed
  by every skill that reads project documents.
