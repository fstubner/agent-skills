# Discount Engine Assessment

## Scope and approach

**Depth:** targeted for the available application files, with the declared automated checks attempted.

**In scope:** `README.md`, `package.json`, `src/discount.js`, and `test/discount.test.js`. The workspace inventory contained no other non-`.agent-input` files. I did not inspect evaluation cases, graders, expected answers, or sibling run outputs.

**Domain/platform:** a small JavaScript/ECMAScript-module business-logic library for calculating order discounts; Node.js runtime. Tooling is declared through npm scripts.

## What I ran

- `npm test` — failed: 1 test passed and 3 failed. The threshold test expected `1000` but received `500`; both five-year loyalty tests expected `1500` but received `1000`.
- `npm run lint` — could not start: `sh: 1: eslint: not found`.
- `npm run build` — failed to start: `Error: Cannot find module '/workspace/scripts/build.js'`.
- A direct Node boundary probe — `discountMinor(10000, 2026)` returned `500`, `discountMinor(10001, 2026)` returned `1000`, a future membership year returned `100`, and missing/invalid membership years returned `NaN`.
- `git status --short` — clean before writing this assessment.

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Correctness | The threshold rule contradicts the documented and tested contract. Orders exactly at the threshold receive 5% instead of 10%, and this also changes the loyalty result at that boundary. | `src/discount.js:5` uses `subtotalMinor > THRESHOLD_MINOR`; `README.md` says “10% at or above”; `test/discount.test.js:9-10` fails with expected `1000`, actual `500`. `test/discount.test.js:13-19` also fails for expected `1500`, actual `1000`. | Implement the specified inclusive comparison (`>=`) and retain explicit tests for exactly-at-threshold, just-below, and just-above values. |
| 2 | High | Correctness / Reliability | Membership years are calculated against a hardcoded date, so the engine becomes stale after that date and can produce a discount for a future membership start year. | `src/discount.js:6` subtracts `memberSince` from `new Date('2026-09-01').getFullYear()`. The direct probe returned `100` for subtotal `10000`, membership year `2030`; the loyalty term is negative and reduces the base discount. | Derive the calculation date from an injected clock or the current business date, validate that `memberSince` is not in the future, and define how anniversary/month/day boundaries are handled. |
| 3 | Medium | Input validation | Invalid or absent membership years silently produce `NaN`, while negative subtotals produce a negative discount. That makes invalid financial inputs observable as invalid output rather than a controlled rejection. | `src/discount.js:6-8` performs arithmetic without validation. The direct probe returned `NaN` for `undefined` and `'not-a-year'`, and `-1000` for subtotal `-10000`. | Validate integer minor-unit subtotals and membership dates/years at the public function boundary; reject invalid or negative values using the project’s chosen error/result convention, and test those paths. |
| 4 | Medium | Build / Maintainability | The package declares a build command that cannot run because its target file is absent. This makes the documented build verification unusable. | `package.json:8` declares `node scripts/build.js`; `npm run build` failed with `MODULE_NOT_FOUND` for `/workspace/scripts/build.js`. | Either add and test the intended build entry point or remove/update the stale script and document the supported verification command. |
| 5 | Medium | Tooling / Maintainability | The declared lint command cannot run in this workspace because its executable and dependency declaration are missing. | `package.json:7` declares ESLint, but `npm run lint` returned `eslint: not found`; `package.json` has no `dependencies` or `devDependencies` section. | Pin ESLint and its configuration in the project’s dependency/lockfile setup, then run lint in CI and locally from a reproducible install. |

## Unconfirmed / Requires Investigation

- The intended behavior for non-integer minor-unit amounts, membership dates versus years, and invalid-input handling is not specified. Confirm these business/API contracts before finalizing validation semantics.
- Whether the fixed date in `src/discount.js:6` is an intentional frozen business date or an accidental test fixture cannot be established from the available files. If intentional, its operational update process is still undocumented.

## Strengths

- The implementation is small and easy to trace: the public calculation is contained in `src/discount.js:4-8`.
- The tests cover the below-threshold path, the exact threshold, loyalty uplift, and the five-year cap (`test/discount.test.js:5-20`), and the first of those tests passes.
- The code uses integer minor units and rounds the final discount (`src/discount.js:8`), which is an appropriate direction for monetary arithmetic.

## Key Risks

The inclusive-threshold defect is a direct failure of the primary business rule (Finding 1). The hardcoded date and absent input validation can cause incorrect monetary results outside the narrow tested examples (Findings 2-3). Build and lint cannot currently provide release confidence (Findings 4-5).

## Priority order

1. Correct the inclusive threshold behavior and add boundary assertions.
2. Replace the hardcoded date with an explicit/injectable business clock and define future-date behavior.
3. Add public-input validation and tests for invalid, negative, and boundary values.
4. Restore reproducible lint and build commands, including pinned tooling.

## Coverage gaps

- No production deployment, CI, runtime configuration, package lockfile, or dependency manifest beyond `package.json` was present to inspect.
- No database, network, persistence, authentication, or UI layers were present in the workspace; those concerns were not assessed.
- Load/performance, concurrency, penetration/security, mutation, and integration testing were not performed.
- ESLint could not be run because the executable was unavailable; therefore style/static-analysis results are unknown.
- The build could not be run because `scripts/build.js` is absent.
- Production usage volume, financial/legal requirements, supported Node versions, and the authoritative business specification were unavailable.

