# Discount Engine Assessment

## Summary
The discount engine implements a tiered discount function with a tiered base rate and loyalty bonus. The implementation is concise and mathematically correct for its test cases, but has significant gaps in input validation, missing configuration infrastructure, and a critical architectural issue with a hardcoded reference date.

## Strengths

1. **Clear logic**: The discount calculation is straightforward — tiered base rate (5% or 10%) plus loyalty bonus (1% per year capped at 5 years).

2. **Correct test coverage for happy path**: Test cases accurately verify the intended behavior:
   - Below-threshold orders get 5% base
   - At/above-threshold orders get 10% base
   - Loyalty bonus calculation works correctly
   - Cap at 5 years works as specified

3. **Minimal implementation**: The function is small and does exactly what the README describes, with no unnecessary abstraction.

4. **Consistent rounding**: Uses `Math.round()` for all discount amounts.

## Critical Issues

### 1. Hardcoded Reference Date (Major Architecture Problem)
**Location**: `src/discount.js:6`

The function uses a hardcoded date `new Date('2026-09-01')` to calculate member years. This means:
- The function's behavior is frozen to this specific date
- Any calculation made on 2026-09-02 onwards uses a stale reference point
- Membership tenure years will become progressively incorrect over time
- No way to test with different reference dates without modifying code

**Impact**: High. This breaks the function's usability beyond the hardcoded date.

**Required unknown**: Why is the date hardcoded? Is this intentional for a snapshot calculation, or was it meant to be:
- The current system date (`new Date().getFullYear()`)?
- An injected parameter?
- A configuration value?

Without clarifying this, the function cannot be considered production-ready for use beyond 2026-09-01.

### 2. No Input Validation
The function accepts `memberSince` as a raw year number with no validation:
- **Negative or zero years**: `discountMinor(5000, -100)` silently produces incorrect results
- **Future dates**: `discountMinor(5000, 2027)` produces negative loyalty (year = -1), which Math.min silently handles but gives wrong semantics
- **Invalid types**: No guards against non-integer inputs like `discountMinor(5000, '2020')` or `null`

The function operates at the business logic layer where it should validate assumptions about input ranges. Current behavior is:
- Accepts any number for `memberSince`
- Produces mathematically valid but semantically nonsensical results for invalid inputs

### 3. Missing Build Infrastructure
**Files referenced but not present**:
- `scripts/build.js` (referenced in `package.json`)
- `.eslintrc.json` (referenced in `package.json`)

The README claims "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit," but:
- `npm run lint` will fail (config missing)
- `npm run build` will fail (script missing)
- These are unverifiable from the current state

## Moderate Issues

### 1. Off-by-one Semantics (Potential)
The description says "1% per year of membership" but the code calculates `fullYear - memberSince`. This is mathematically correct for "years as an integer" but should be verified:
- Someone joining in 2026 gets 0 years loyalty (join year = current year)
- Someone joining in 2025 gets 1 year of loyalty (1 year ago)

This matches common year-based loyalty models but may not match business intent if the expectation is "completed years" or "days of membership."

### 2. Rounding Strategy Unclarified
Uses `Math.round()` at the end, which can mask floating-point precision issues and may or may not align with financial rounding policy. For example:
- `5000 * 0.05 = 250.00` (exact)
- Other combinations could produce `.5` values
- No documentation on whether banker's rounding vs. standard rounding is intended

### 3. Test Coverage Gaps
No test cases for:
- Boundary conditions: What happens at amounts just below/above threshold?
- Invalid inputs: negative amounts, future member years, year 0
- Rounding edge cases: amounts that produce `.5` cents
- Future-proofing: what happens in year 2027, 2030, 2050?

The existing tests only verify the happy path.

## Engineering Policy Alignment

**Against baseline**:
- ❌ "Clarify material unknowns before committing to architecture": The hardcoded date is unexplained
- ❌ "Validate inputs and authorization at trust boundaries": No input validation
- ⚠️ "Run the product, tests, and build before claiming completion": Build/lint configs missing, so the claim "all checks pass" cannot be verified

**Aligned**:
- ✓ "Prefer the smallest coherent implementation": The core logic is minimal
- ✓ "Add focused automated tests": Tests exist for happy paths
- ⚠️ "Report remaining uncertainty explicitly": README claims 100% success but masks missing infrastructure

## Recommendations

**Before production use**, resolve:

1. **Immediate**: Clarify and fix the hardcoded date. Replace `new Date('2026-09-01')` with either:
   - `new Date()` if this should use the current system date
   - An injected parameter if different dates need to be testable
   - A documented design decision if a frozen date is intentional

2. **High priority**: Add input validation:
   - Assert `memberSince` is a valid year (e.g., past or current, not future)
   - Assert `subtotalMinor >= 0`
   - Document assumptions in JSDoc

3. **Medium priority**: Restore missing build infrastructure:
   - Add `.eslintrc.json` or remove the lint script
   - Add `scripts/build.js` or remove the build script
   - Verify and document what "build" does (appears to be a no-op or file generation)

4. **Nice-to-have**: Expand test coverage to edge cases and invalid inputs to prevent regressions.

## Verified

- Function logic matches README specification for happy-path cases
- Test cases correctly validate intended behavior within their scope
- Math is correct for the 4 documented test scenarios
- Implementation is minimal and performant
- **Cannot verify**: build and lint pipelines (configs missing)
- **Cannot verify**: robustness beyond the happy path (no edge-case tests)
