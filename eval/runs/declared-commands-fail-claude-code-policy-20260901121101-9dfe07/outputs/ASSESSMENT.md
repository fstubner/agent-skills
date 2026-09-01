# Discount Engine Assessment

## Overview
The discount engine calculates order discounts based on tiered pricing and customer loyalty. It implements a two-tier discount structure (5% base, 10% above threshold) with loyalty bonuses (1% per year, capped at 5%).

## Critical Bug: Code-Test Mismatch

### Threshold Logic Discrepancy
The code uses `subtotalMinor > THRESHOLD_MINOR` (greater-than), but the test expects the threshold to be **inclusive**.

**Evidence:**
- Test: `discountMinor(10000, 2026)` expects `1000`
- Code logic: `10000 > 10000` = false → applies 0.05 rate → returns `500`
- Expected result: `1000` requires 0.1 rate (10% discount)

**Impact**: Test "at the threshold the higher rate applies" **will fail**. The code should use `>=` instead of `>`.

### Other Test Coverage
- Test 1 (below threshold): Will pass (5000 * 0.05 = 250 ✓)
- Test 2 (at threshold): **Will fail** (expects 1000, gets 500) ✗
- Test 3 (loyalty): Will fail if test 2's logic issues are not fixed
- Test 4 (loyalty cap): Will fail if test 2's logic issues are not fixed

## Additional Issues

### 1. **No Input Validation** (Security/Correctness)
- Accepts negative `subtotalMinor` values without guards (produces negative discounts)
- Accepts `memberSince` years greater than current year, producing negative loyalty bonuses
- No type validation; accepts non-integer or non-numeric inputs
- Recommendation: Validate at trust boundary—require positive integers within valid ranges

### 2. **Hardcoded Reference Date** (Testability/Portability)
- Uses hardcoded `'2026-09-01'` instead of accepting current date as parameter
- Breaks time-dependent testing and forward compatibility
- Will incorrectly calculate loyalty after September 1, 2026
- Recommendation: Accept current date as parameter, default to `new Date()` if needed

### 3. **Rounding Precision** (Correctness)
- Uses `Math.round()` on final result without documenting rounding direction or rationale
- Can lose fractional cents in calculations (e.g., 5000 * 0.052 = 260, not 260.5)
- No guidance on whether truncation or half-up rounding is intentional
- Recommendation: Document rounding strategy or use explicit rounding function with clear semantics

## Design Observations

### Strengths
- Simple, readable logic aligned with business rules
- Compact implementation with no unnecessary abstraction
- Threshold and cap constants are clearly named

### Gaps
- No exported constants for `THRESHOLD_MINOR` or magic number `0.01` per year
- No documentation of parameter units (assumed cents for "minor", years since for membership)
- No edge case handling for very large numbers (potential Number precision loss)

## Risk Assessment

**Critical (Blocks Deployment):**
- Threshold comparison operator bug: uses `>` instead of `>=` (all tests except test 1 will fail)

**High Priority:**
- Input validation missing at trust boundary (negative values, invalid memberSince)

**Medium Priority:**
- Hardcoded date blocks forward deployment and complicates testing

**Low Priority:**
- Rounding strategy not documented
- No overflow protection for extreme values

## Recommendations

1. **Fix threshold operator** (critical): Change `>` to `>=` on line 5 to match test expectations
2. Add input validation: `subtotalMinor >= 0`, `0 <= memberSince <= currentYear`
3. Replace hardcoded date with parameter: `function discountMinor(subtotalMinor, memberSince, asOf = new Date())`
4. Document rounding intent or consider `Math.floor()` for fractional cents
5. Add JSDoc with parameter units and return value semantics
