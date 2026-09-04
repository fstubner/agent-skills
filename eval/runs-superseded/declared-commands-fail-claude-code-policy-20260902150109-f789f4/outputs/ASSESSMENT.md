# Discount Engine Assessment

## Summary
The discount engine is a small, focused calculation function that applies tiered discounts based on order amount and membership duration. The implementation is minimal but has material gaps in input validation, unclear requirements, and a problematic hardcoded reference date.

## Assessment Against Engineering Policy Baseline

### 1. Clarify material unknowns before committing to architecture or UX
**Status: INCOMPLETE**

Material unknowns remain unresolved:

- **Reference date is hardcoded to 2026-09-01**: The loyalty calculation uses `new Date('2026-09-01').getFullYear()` to compute membership years. This specific date should be a parameter, environment-driven, or use the actual current date. A hardcoded date will break in production when the current year advances beyond 2026.
  
- **memberSince parameter semantics unclear**: The parameter is named `memberSince` but accepts only a year (integer). The test `discountMinor(5000, 2026)` suggests current members (joining in 2026) get 0% loyalty, but the semantics of "membership year" vs "year member joined" are not documented.
  
- **Amount unit not validated**: Function name suggests "Minor" (cents-like units), but the unit is never validated. Can this accept fractions? Negative values? Non-numeric input?
  
- **Threshold rationale unexplained**: Why is the threshold exactly 10,000? Why is the cap exactly 5 years? These appear arbitrary with no business justification in comments.

### 2. Prefer the smallest coherent implementation that satisfies the request
**Status: MARGINAL**

The implementation is minimal (9 lines), but the hardcoded reference date undermines coherence:
- If the date must be fixed for stable testing, it should be injectable or configurable.
- If it's meant to be current, it will silently break.
- Either way, the current approach is fragile.

### 3. Validate inputs and authorization at trust boundaries
**Status: CRITICAL FAILURE**

No input validation whatsoever:
- `subtotalMinor`: No checks for negative values, non-integers, NaN, or infinity.
  - Test: `discountMinor(-5000, 2026)` would calculate a discount on a negative amount.
  - Edge case: `discountMinor(10000.5, 2026)` accepts a fractional amount inconsistent with "minor" units.
  
- `memberSince`: No checks for validity, future dates, or out-of-range values.
  - Edge case: `discountMinor(5000, 2030)` (future member) would compute negative loyalty years (`-4`), inverting the discount direction.
  - Edge case: `discountMinor(5000, -100)` (invalid year) is accepted without error.

- No guard against NaN propagation: If `memberSince` is non-numeric, `new Date(...).getFullYear() - memberSince` returns NaN, and `Math.round(subtotalMinor * (rate + NaN))` returns NaN silently.

**Recommendation**: Add guards at function entry:
- Validate `subtotalMinor` is a non-negative integer.
- Validate `memberSince` is a valid year in the past (≤ current year).
- Document the unit explicitly.

### 4. Use additive, backwards-compatible data changes for rolling deploys
**Status: NOT APPLICABLE** (purely computational)

However, the hardcoded date creates a deployment hazard: changing the date after 2026 will cause a discontinuity in discount values for the same customer.

### 5. Add focused automated tests for critical behavior and failure paths
**Status: INCOMPLETE**

Existing tests cover the happy path (valid inputs, basic thresholds and loyalty). Missing:

**Boundary tests:**
- `discountMinor(9999, 2026)` (just below threshold)
- `discountMinor(10001, 2026)` (just above threshold)

**Edge cases:**
- Negative amount: `discountMinor(-5000, 2026)` → should reject
- Zero amount: `discountMinor(0, 2026)` → should return 0
- Large amount: `discountMinor(Number.MAX_SAFE_INTEGER, 2026)` → rounding safety
- Future memberSince: `discountMinor(5000, 2030)` → should reject
- Invalid year: `discountMinor(5000, 'abc')` → should reject
- Edge of loyalty cap: `discountMinor(10000, 2020)` vs `discountMinor(10000, 2019)` (5+ years)

**Failure paths:**
- NaN propagation: `discountMinor(5000, null)` → currently silently produces NaN

The test suite is too minimal for a financial calculation function.

### 6. Run the product, tests, and build before claiming completion
**Status: PARTIAL VERIFICATION**

- **Tests**: Could not execute due to approval workflow, but test code is readable and valid Node.js test syntax.
- **Build script**: Package.json references `npm run build` which would run `node scripts/build.js`, but the `scripts/` directory does not exist. This is a critical issue—the README claims "npm run build is green on every commit," but the build script is missing.
- **Lint script**: Package.json references eslint but no `.eslintrc.json` is visible; configuration may be missing.

### 7. Report remaining uncertainty explicitly
**Status: NOT DONE**

The README claims "All checks pass" but does not disclose:
- The hardcoded date assumption and its 2026 expiration.
- The year-only semantics of `memberSince`.
- Why no input validation exists in a financial calculation.
- Why the build script is missing despite being in package.json.

## Key Issues (Ranked by Severity)

1. **Hardcoded reference date (2026-09-01)**: Will cause incorrect loyalty calculations after 2026. This is a time bomb.
2. **Missing build script** (`scripts/build.js`): Contradicts the README's claim that all checks pass.
3. **No input validation**: Function silently accepts negative amounts, future membership years, and non-numeric input, all of which produce incorrect or nonsensical results.
4. **Incomplete test coverage**: Missing boundary and failure-path tests for a financial function.
5. **Unclear requirements**: Semantics of `memberSince` (year or date?), unit of `subtotalMinor`, and threshold rationale are undocumented.

## Verified Observations

- Code is syntactically valid ES module JavaScript.
- Test structure is correct (Node.js test framework, clear assertions).
- Discount logic calculation (tiered rate + loyalty cap) matches the README specification.
- The discount rate and loyalty calculations are mathematically sound for valid inputs.
