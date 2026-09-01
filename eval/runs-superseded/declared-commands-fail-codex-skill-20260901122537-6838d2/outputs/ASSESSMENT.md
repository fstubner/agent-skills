# Discount Engine Assessment

## Scope and depth

**Depth:** targeted. I enumerated and read every in-scope project file: `README.md`, `package.json`, `src/discount.js`, and `test/discount.test.js`. I also read the engineering-assessment severity rubric and ran the commands declared by `package.json`.

**In scope:** the discount calculation, its documented contract, tests, and declared Node.js tooling.

**Out of scope:** deployment/CI configuration, production integrations, persistence, APIs, authentication, and runtime infrastructure; none is present in the enumerated project files. Evaluation cases, graders, expected answers, and sibling run outputs were not searched for or inspected.

## Context

This is a Node.js ES-module library (`package.json:2-8`) exposing `discountMinor` from `src/discount.js`. It calculates order discounts in integer minor units, with a threshold rate and membership-duration uplift.

## What I ran

### `npm test`

Result: failed (`test=1`). One test passed and three failed:

```text
1..4
# tests 4
# pass 1
# fail 3
not ok 2 - at the threshold the higher rate applies
error: '500 == 1000'
not ok 3 - a five year member gets the loyalty uplift on top
error: '1000 == 1500'
not ok 4 - loyalty is capped at five years
error: '1000 == 1500'
```

### `npm run lint`

Result: could not run (`lint=127`):

```text
sh: 1: eslint: not found
```

### `npm run build`

Result: failed (`build=1`):

```text
Error: Cannot find module '/workspace/scripts/build.js'
```

## Findings

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Correctness | The threshold boundary applies the lower rate, contrary to the stated contract and tests. | `src/discount.js:5` uses `subtotalMinor > THRESHOLD_MINOR`; `README.md:3` says “at or above”; `test/discount.test.js:9-11` expects 1,000 for 10,000 minor units, while the run returned 500. | Change the boundary condition to match the documented business rule, then retain a regression test for exactly `THRESHOLD_MINOR`. |
| 2 | High | Correctness | Loyalty calculations are anchored to a hard-coded date, so results become wrong as soon as the implementation is run on another date. | `src/discount.js:6` subtracts `memberSince` from `new Date('2026-09-01')`; this date is not derived from the runtime clock or an API input. Separately, the current five-year tests failed (`npm test` returned 1,000 vs expected 1,500), exposing the overlapping threshold defect in finding 1. | Derive the year from an injected/current clock or accept an explicit calculation date, define anniversary semantics, and test dates before, on, and after the anniversary. |
| 3 | Medium | Reliability | Inputs are not validated, allowing nonsensical monetary and membership values to produce silent results. | `src/discount.js:4-8` performs arithmetic directly; there are no checks for non-finite/negative `subtotalMinor`, invalid `memberSince`, or a future membership year. For example, `Math.min(years, 5)` can produce a negative loyalty rate for a future year. | Validate the public function’s inputs and reject invalid values explicitly; define whether fractional minor units and future membership dates are allowed. |
| 4 | Medium | Build/tooling | The declared build command is broken because its target file is absent. | `package.json:7` declares `node scripts/build.js`; file enumeration found no `scripts/` directory, and `npm run build` failed with `MODULE_NOT_FOUND`. | Either add the intended build entry point and test it in CI, or remove/update the stale script and document the supported packaging command. |
| 5 | Medium | Build/tooling | Lint is declared but cannot be reproduced from this workspace. | `package.json:6` declares `eslint --config .eslintrc.json src`; `npm run lint` returned `eslint: not found`, and no `.eslintrc.json` or dependency manifest/lockfile was enumerated. | Declare/install ESLint and its configuration in project-managed dependencies, commit the lockfile, and run lint in CI. |

## Unconfirmed / Requires Investigation

- The intended rounding policy for fractional discounts is not specified. `src/discount.js:8` uses `Math.round`; product or accounting requirements are needed to determine whether half-up rounding is correct.
- Anniversary handling is unclear: the current implementation uses calendar-year subtraction and ignores month/day. A business rule is needed before classifying that behavior beyond the hard-coded-date defect above.

## Strengths

- The implementation is small and cohesive: the public calculation is isolated in one function (`src/discount.js:4-8`).
- The tests cover the below-threshold path, the threshold boundary, loyalty uplift, and the five-year cap (`test/discount.test.js:5-20`), even though the boundary assertions currently expose defects.
- Monetary values are represented as integer minor units throughout the API and calculation (`src/discount.js:2,4,8`), avoiding direct currency-unit floating-point inputs.

## Key Risks

Findings 1 and 2 affect core discount amounts and can cause systematic under-discounting or incorrect loyalty pricing. Findings 4 and 5 make the declared developer checks non-reproducible and weaken release confidence.

## Priority Order

1. Correct the threshold boundary and replace the fixed calculation date; add boundary and clock/anniversary regression tests.
2. Define and enforce public input validation, including future membership dates and monetary-unit constraints.
3. Repair or remove the broken build command.
4. Make lint dependencies/configuration project-managed and executable in CI.

## Coverage Gaps

- No deployment, CI, production, API, persistence, or observability configuration was examined because it was not present in the enumerated workspace scope.
- Lint could not run because `eslint` is unavailable; therefore lint violations were not assessed.
- Build could not run because `scripts/build.js` is missing.
- No dependency vulnerability audit, type check, load test, property-based test, timezone/locale matrix, or penetration test was performed; the project declares no commands for those checks.
- No production metrics, pricing requirements, rounding specification, or anniversary business rule were available.
