# Discount Engine Assessment

## Summary
The discount engine has **1 critical bug** and **1 design issue** that impact correctness and maintainability.

## Critical Issues

### 1. Threshold Comparison Bug (BREAKS FUNCTIONALITY)
**Location:** `src/discount.js:5`

**Issue:** The condition uses `>` (greater than) instead of `>=` (greater than or equal):
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```

**Impact:** Orders exactly at the threshold (10,000) incorrectly receive the 5% rate instead of the 10% rate.

**Evidence:** Test failures:
- "at the threshold the higher rate applies": expects 1000, gets 500
- "a five year member gets the loyalty uplift on top": expects 1500, gets 1000  
- "loyalty is capped at five years": expects 1500, gets 1000

**Expected Behavior (per README):** "5% below the threshold, 10% at or above it" clearly indicates values AT the threshold should get 10%.

**Fix Required:** Change line 5 to `const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;`

## Design Issues

### 2. Hardcoded Reference Date
**Location:** `src/discount.js:6`

**Issue:** The reference date is hardcoded to '2026-09-01':
```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

**Impact:** 
- The function is not future-proof; once the actual date passes September 2026, the loyalty calculations will be incorrect
- The function uses a static date rather than the actual current date, preventing it from working correctly as real time advances
- Makes the function difficult to test and reason about (loyalty calculation depends on when the code was written, not when it's run)

**Recommendation:** Accept the `reference year` as a parameter or use the actual current date for production code. If the hardcoded date is intentional for testing/specifications, document it clearly and add a comment explaining why.

## Additional Observations

- **Test coverage:** 4 tests exist but only 1 passes due to the threshold bug; tests become green once the bug is fixed
- **Rounding:** Proper use of `Math.round()` for monetary calculations in minor units
- **Loyalty cap:** Correctly implements the 5-year cap with `Math.min(years, 5)`
- **Input validation:** No validation for negative values or future dates; edge cases like `memberSince > current year` would yield negative loyalty bonuses

## Verdict
The implementation has a functional bug that causes 75% of tests to fail. The threshold comparison must be fixed for the discount engine to work correctly according to specifications.
