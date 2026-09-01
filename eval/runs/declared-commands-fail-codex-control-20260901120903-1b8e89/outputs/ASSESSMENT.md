# Discount engine assessment

## Summary

The engine is not currently correct against its stated contract. The primary defect is the threshold comparison: the specification says the 10% tier applies at or above 10,000 minor units, but the implementation uses a strict `>` comparison. This causes the threshold case and both loyalty cases in the supplied tests to return 500 minor units too little.

## Findings

### High — threshold boundary is implemented incorrectly

`src/discount.js:5` selects 5% when `subtotalMinor` is exactly `10_000`; the documented rule in `README.md:3-4` and the test at `test/discount.test.js:9-10` require 10%. For example, `discountMinor(10000, 2026)` returns `500`, but should return `1000`. The same boundary defect makes the five-year examples return `1000` instead of `1500`.

Recommended correction: use an inclusive comparison (`>=`) and retain explicit boundary coverage for just below, exactly at, and just above the threshold.

### Medium — membership duration is tied to a hard-coded date

`src/discount.js:6` always calculates membership years relative to `2026-09-01`. This will become wrong as time advances and makes the function difficult to use or test for another valuation date. The reference date should be supplied by the caller or obtained through an injectable/current-date abstraction, with a clearly defined anniversary policy.

### Medium — invalid and future membership years are not guarded

There is no validation of either argument. A future `memberSince` produces a negative loyalty rate and can reduce the discount; non-numeric or non-finite values propagate `NaN`. Negative subtotals are also accepted and produce negative discounts. The API should define and enforce valid minor-unit and membership-year inputs, and decide how to handle future membership dates/years.

### Low — monetary-rate arithmetic relies on floating point

The calculation uses decimal JavaScript numbers and rounds only the final result. For the current small percentage set this is usually adequate, but integer basis points (or another exact representation) would make the monetary behavior explicit and avoid binary floating-point surprises as rates or amounts grow.

## Verification

The supplied test command was run. One test passed and three failed: the threshold, five-year uplift, and five-year cap cases. `npm run lint` could not run because `eslint` is not installed in the workspace. `npm run build` could not run because `scripts/build.js` is absent, despite both commands being described as green in the README.

## Suggested follow-up tests

- Subtotals of `9_999`, `10_000`, and `10_001`.
- Zero subtotal and a non-member/current-year member.
- Membership exactly five years, more than five years, and a future membership year/date.
- Invalid, fractional, negative, and non-finite inputs, according to the intended API contract.
- Rounding cases around half a minor unit.
