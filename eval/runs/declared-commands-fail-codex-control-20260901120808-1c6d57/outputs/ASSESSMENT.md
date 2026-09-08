# Discount engine assessment

## Overall assessment

The engine is not currently correct against its documented contract, and the repository's stated validation is not reproducible. The primary functional defect is the threshold comparison; it causes the boundary case and all loyalty cases at the boundary to under-discount.

## Findings

### High — threshold boundary uses the wrong comparison

`src/discount.js:5` selects the 10% rate only when `subtotalMinor > 10_000`. The README says the higher rate applies “at or above” the threshold, and the test at exactly 10,000 expects 1,000 minor units for a non-member. The implementation returns 500. This same defect makes the five-year and capped-loyalty tests return 1,000 instead of 1,500.

Recommended correction: make the comparison inclusive (`>=`) if the README and existing tests represent the intended contract.

### High — the calculation date is hard-coded

`src/discount.js:6` always calculates membership years from `2026-09-01`. The result will become stale after that date and is already incorrect for calls made on another date. This also makes behavior dependent on an undocumented frozen date rather than the actual calculation date or an explicitly supplied “as of” date.

Recommended correction: inject or accept the calculation date, or derive it from the current date if that is the intended business rule; add tests around the membership anniversary boundary.

### Medium — membership-year inputs are not validated or normalized

`memberSince` is subtracted directly from the year, so future years produce negative loyalty and can reduce the base discount. Non-numeric or missing values can produce `NaN`, which then propagates through `Math.round`. The implementation also treats a membership year as a full year without considering month/day, so it cannot correctly represent whether this year's anniversary has occurred.

The API should define and enforce accepted input types/ranges, and future membership dates should be rejected or handled explicitly.

### Medium — subtotal inputs are not validated

Negative, fractional, non-finite, or non-numeric subtotal values are accepted. Negative subtotals produce negative discounts; `NaN`/infinite values produce unusable results. Since the function is expressed in minor units, the contract should also state whether fractional minor units are invalid and whether the discount is allowed to exceed the subtotal.

### Low — numeric and policy assumptions are implicit

The rates are represented as binary floating-point decimals and the final result is rounded once. This is usually adequate for these small rates, but the rounding policy is undocumented, and large values may exceed JavaScript's safe integer precision. The maximum combined rate is currently 15% for a five-year member, but no explicit invariant prevents future rule changes from generating a discount above the subtotal.

## Verification

Executed from `/workspace` without changing implementation code:

- `npm test`: failed; 3 of 4 tests failed. The observed mismatches were 500 vs 1,000 and 1,000 vs 1,500 for the three boundary/loyalty cases.
- `npm run lint`: could not run; `eslint` is not installed/available, and `.eslintrc.json` is absent from the workspace.
- `npm run build`: could not run; `scripts/build.js` is absent.

The README's claim that all checks are green is therefore not true for the current workspace.
