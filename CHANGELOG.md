# Changelog

## [0.4.0] — 2026-07-18

### Added
- `_suite/schemas/` for acceptance, architecture, eng-structure, backend, suite-profile, eval-result
- `backend-engineering/scripts/check-backend.js` + fixtures
- `eval/` cases, suite thresholds, result scaffolder, `score-eval-results.mjs`
- GitHub issue template for unprimed eval runs
- Schema validation in fixture CI

### Changed
- STATUS lists package assets instead of an open-gap backlog
- Install / README pin `v0.4.0`

## [0.3.0] — 2026-07-18

### Fixed
- `accept-check.js`: SHIP is reachable — self-grade is a **note** unless `--acceptor-context same|separate`
- Missing architecture evidence is `not_evaluated`, not `pass`
- Broader project classification via `_suite/lib/classify-project.js` + `suite-profile.json`

### Added
- Three-layer model docs (`_suite-charters/LAYERS.md`)
- `suite.manifest.json` + `scripts/install.mjs`
- Fixture corpus + `scripts/run-fixture-tests.mjs`
- GitHub Actions CI
- MIT `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`

### Changed
- README claims narrowed to verified procedures + documented limitations
- Install docs prefer tagged releases (`v0.3.0`)

## [0.2.0] — 2026-07-18

### Added
- First-class `product-management`, `frontend-ux`, `backend-engineering`
- `INSTALL.md`, `STATUS.md`, principles-first `frontend-design`

## [0.1.0] — 2026-07-18

### Added
- Initial public monorepo
