# Discount engine assessment

## Executive summary

The engine is not currently reliable enough to ship. The core behavior disagrees with its README and tests at the threshold, and the declared test, lint, and build baseline is not green. The implementation also accepts unchecked inputs and uses a fixed date, creating correctness and operational risks at a trust boundary.

## Findings

### High — threshold rule is implemented incorrectly

`src/discount.js:5` selects 5% when `subtotalMinor` is exactly `10_000` because it uses `>`. The README says “at or above,” and the test named “at the threshold the higher rate applies” expects 10%. The same defect causes both five-year membership tests to return 1,000 instead of 1,500. This is a direct business-rule failure.

Observed result: `npm test` fails 3 of 4 tests; the failing cases are the threshold and both loyalty cases.

### High — release validation scripts are broken or incomplete

`package.json` declares lint and build commands, but ESLint is not available in the environment and `.eslintrc.json` is not present in the workspace. `npm run build` references missing `scripts/build.js`. Therefore the README claim that all checks pass cannot be verified and is contradicted by the current workspace.

### High — inputs are not validated

`discountMinor` accepts arbitrary values for both arguments. Negative, fractional, `NaN`, `Infinity`, non-numeric strings, invalid membership years, and future membership years are not rejected. JavaScript coercion can silently produce nonsensical rates or `NaN`, and negative subtotals can produce negative discounts. Since this function is a trust boundary for money calculations, it should define and enforce its input contract before calculating.

Material requirements to clarify before changing the API: whether subtotal must be a non-negative integer minor-unit amount; whether membership is represented by a year or a full date; and whether invalid inputs should throw, return a result object, or be rejected by the caller.

### High — calculation date is hard-coded

`src/discount.js:6` calculates membership duration from `new Date('2026-09-01')`. The result becomes stale after that date and cannot correctly represent date-of-membership anniversaries. It also makes behavior dependent on an implicit business “as of” date rather than the execution date or an explicit injectable date. This needs a clarified policy for whether loyalty is based on elapsed full years, calendar years, or a supplied pricing date.

### Medium — loyalty calculation has edge-case behavior

`Math.min(years, 5)` caps only the upper bound. A future `memberSince` produces negative loyalty, potentially reducing the discount below the base rate. A non-integer or date-like value can also produce unexpected coercion. The intended maximum, minimum, and treatment of membership starting dates should be explicit.

### Medium — monetary arithmetic and rounding policy are implicit

The implementation uses binary floating-point percentage arithmetic and rounds the final amount with `Math.round`. For ordinary small values this may be acceptable, but the policy does not state whether rounding is half-up, whether rates should be represented in basis points, or whether the discount may exceed the subtotal. Boundary tests for half-minor-unit values and maximum supported amounts are absent.

## Test coverage assessment

The tests cover one below-threshold case and a few loyalty cases, but they do not cover the actual boundary below/at/above the threshold consistently, invalid inputs, future membership, fractional values, large amounts, rounding boundaries, or date rollover behavior. They also encode the intended threshold behavior clearly enough to expose the implementation defect.

## Recommended remediation order

1. Resolve the threshold and membership-date semantics, then align implementation, README, and tests.
2. Add explicit validation and define failure behavior for all public inputs.
3. Replace the hard-coded date with an explicit, testable pricing/as-of date or a documented clock policy.
4. Make the money representation and rounding/maximum-discount policy explicit.
5. Restore reproducible lint and build tooling, then run the full product, test, lint, and build checks in CI.

## Verification performed

- Inspected `README.md`, `src/discount.js`, `test/discount.test.js`, and `package.json`.
- Ran `npm test`: failed, 1 passed and 3 failed.
- Ran `npm run lint`: failed to start because `eslint` is unavailable.
- Ran `npm run build`: failed because `scripts/build.js` is missing.
- No application code or tests were changed.

