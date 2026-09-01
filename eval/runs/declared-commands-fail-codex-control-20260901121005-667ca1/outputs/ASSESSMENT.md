# Discount engine assessment

## Summary

The engine is not currently correct against its stated contract. The threshold
rule is implemented as “over” rather than “at or above,” causing orders exactly
at 10,000 minor units to receive 5% instead of 10%. This is a high-severity
functional defect because it directly affects the boundary documented in
`README.md` and causes three of the four existing tests to fail.

## Findings

### 1. Threshold boundary is incorrect — high severity

`src/discount.js` selects the higher base rate only when
`subtotalMinor > 10_000`. The documented behavior and test name require the
higher rate when `subtotalMinor >= 10_000`.

Observed behavior:

- `discountMinor(10_000, 2026)` returns `500` (5%).
- The expected result is `1_000` (10%).
- With a five-year member, the same input returns `1_000` instead of `1_500`.

The threshold comparison should be reconciled with the business rule and its
tests.

### 2. Membership-year calculation is tied to a fixed date — medium severity

The calculation always uses `2026-09-01`, so results become stale after that
date and do not represent the actual order or evaluation date. It also uses
only calendar years, without considering whether the membership anniversary
has occurred. The engine should receive a date/clock explicitly or derive the
current date through an injectable time source, with a defined anniversary
policy.

### 3. Invalid and future membership inputs are not handled — medium severity

There is no validation for `memberSince`. Non-numeric values can produce `NaN`
and ultimately a `NaN` result; future years produce negative loyalty, reducing
the discount below the base rate. The API should define and enforce behavior
for invalid, missing, fractional, and future membership years.

### 4. Monetary and numeric input constraints are unspecified — medium severity

The function assumes a finite, non-negative integer `subtotalMinor`, but does
not validate that assumption. Negative, fractional, infinite, or `NaN`
subtotals can yield nonsensical results. Rounding the final discount is
reasonable for minor units, but the contract should explicitly specify the
rounding policy and validate inputs before calculation.

## Verification

`npm test` was run: 1 test passed and 3 failed, all failures involving the
threshold boundary or loyalty calculation at that boundary. `npm run lint`
could not run because `eslint` is not installed in the workspace. `npm run
build` could not run because `scripts/build.js` is missing. No implementation
code was changed.

## Recommended priority

First correct and test the inclusive threshold rule. Then define validation and
time semantics, add boundary/invalid-input tests, and restore the missing lint
and build dependencies or scripts so the package claims can be verified.
