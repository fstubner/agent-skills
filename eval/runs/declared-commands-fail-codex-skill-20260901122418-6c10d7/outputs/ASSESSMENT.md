# Discount Engine Engineering Assessment

## Scope and depth

Depth: deep, within the discount-engine workspace.

In scope: `package.json`, `README.md`, `src/discount.js`, and
`test/discount.test.js`; the declared build, test, lint, and audit workflow;
direct behavior probes for boundary and membership inputs.

Out of scope: evaluation cases, graders, expected answers, sibling run
outputs, and any production/deployment environment or external callers. None
were inspected.

## Domain and platform

This is a small Node.js ES-module business-logic library for calculating order
discounts in minor currency units. It has no runtime dependencies and uses the
Node test runner plus ESLint/build scripts declared in `package.json`.

## What I ran

- `npm run` — succeeded and listed `test`, `lint`, and `build` scripts.
- `npm test` — ran 4 tests; 1 passed and 3 failed. The failures were the
  threshold and two loyalty cases; reported actual values were `500`, `1000`,
  and `1000` versus expected `1000`, `1500`, and `1500`.
- `npm run build` — failed to start because `scripts/build.js` is missing:
  `Error: Cannot find module '/workspace/scripts/build.js'`.
- `npm run lint` — failed to start because `eslint` is not installed:
  `sh: 1: eslint: not found`.
- `npm audit --omit=dev` — failed because no lockfile exists:
  `npm error code ENOLOCK` and `This command requires an existing lockfile`.
- `node --input-type=module -e ...` behavior probes — returned:
  `9999/2026 -> 500`, `10000/2026 -> 500`, `10001/2026 -> 1000`,
  `10000/2021 -> 1000`, `10000/2010 -> 1000`, and `10000/2027 -> 400`.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Correctness | The threshold boundary applies the lower rate, contradicting the stated contract that the higher rate applies at or above the threshold. | `src/discount.js:5` uses `subtotalMinor > THRESHOLD_MINOR`; `README.md` says “at or above”; `test/discount.test.js:10` fails with actual `500` vs expected `1000`. | Change the boundary condition to include equality and retain explicit tests for one value below, exactly at, and one value above the threshold. |
| 2 | High | Correctness / Reliability | Loyalty calculation is anchored to a hard-coded date, making results stale as time advances and incorrect for future membership years. | `src/discount.js:6` constructs `new Date('2026-09-01')`; the probe `discountMinor(10000, 2027)` returned `400`, a 4% discount rather than a non-negative loyalty adjustment. | Accept an explicit calculation date or use the current date supplied by the caller; validate membership year/date so future membership cannot create a negative loyalty rate. |
| 3 | Medium | Input validation | The public function accepts unchecked numeric inputs and membership values, allowing invalid orders or rates to propagate silently. | `src/discount.js:4-8` performs arithmetic without validating `subtotalMinor` or `memberSince`; the future-year probe demonstrates a silent invalid-result path. | Validate finite, non-negative minor-unit subtotals and a valid membership date/year not in the future; define and test behavior for invalid input. |
| 4 | Medium | Build / Maintainability | The repository advertises a green build, but its declared build command references a file absent from the repository, so the build cannot provide release evidence. | `package.json:9` declares `node scripts/build.js`; `npm run build` failed with `MODULE_NOT_FOUND`; `README.md:5` claims the checks are green on every commit. | Restore and test the intended build script, or remove/update the stale script and README claim; run the build in CI. |
| 5 | Medium | Dependencies / Verification | Dependency reproducibility and vulnerability auditing are not established because there is no lockfile and lint tooling is unavailable. | `npm audit --omit=dev` returned `ENOLOCK`; `npm run lint` returned `eslint: not found`; `package.json` declares no dependencies or devDependencies. | Commit the intended package-manager lockfile and declare/pin lint tooling, then run audit and lint in a reproducible environment. |

## Unconfirmed / Requires Investigation

- The intended definition of “year of membership” is not fully specified. The
  code subtracts calendar years only; no join month/day is accepted, so it is
  unknown whether anniversary-accurate calculation is required. Confirm the
  business rule before selecting the date algorithm.
- It is unknown whether `subtotalMinor` may be fractional, negative, or larger
  than JavaScript’s safe integer range. Production input contracts and currency
  limits were unavailable.

## Strengths

- The core calculation is a small, side-effect-free exported function, which
  makes deterministic unit testing straightforward (`src/discount.js:4-8`).
- The threshold and five-year cap are represented directly in the logic, and
  the test suite includes below-threshold, boundary, loyalty, and cap cases
  (`test/discount.test.js:5-20`), even though three currently fail.

## Key risks

Findings 1 and 2 affect the amount returned for normal orders and should block
release until corrected. Findings 3-5 weaken the safety and repeatability of
those calculations and checks.

## Priority order

1. Fix and test the inclusive threshold rule (Finding 1).
2. Remove the fixed calculation date and reject future/invalid membership input
   (Findings 2 and 3).
3. Repair or remove the broken build declaration and update the README (Finding
   4).
4. Add reproducible lint/audit tooling and a lockfile (Finding 5).

## Coverage gaps

- No production callers, API boundary, deployment configuration, CI workflow,
  runtime metrics, database, or external currency rules were available.
- No load, integration, property-based, penetration, or mutation testing was
  performed.
- Build and lint could not be executed successfully for the reasons recorded
  in “What I ran”; audit could not run without a lockfile.
- Type checking was not attempted because this is JavaScript and no type-check
  script or configuration is declared.
- No repository-specific smell, organization, backend, frontend, or migration
  checker was applicable to this standalone discount module.
