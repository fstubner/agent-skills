# Discount Engine Assessment

## Overview
The discount engine is a tiered membership discount calculator that applies base rates (5% or 10%) based on order value and adds loyalty bonuses based on membership duration. **The implementation has critical bugs that cause 3 of 4 tests to fail.**

## Test Results
- **Pass:** 1/4 tests
- **Fail:** 3/4 tests

## Critical Issues

### 1. Threshold Boundary Bug (Test Failures #2, #3, #4)
**Severity:** Critical

The threshold check uses strict greater-than (`>`) instead of greater-than-or-equal (`>=`):
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```

**Impact:**
- Orders at exactly 10,000 apply the 5% rate instead of the intended 10% rate
- This causes cascading failures in all tests involving orders at the threshold
- Expected vs. Actual:
  - `discountMinor(10000, 2026)` returns 500 but expects 1000
  - `discountMinor(10000, 2021)` returns 1000 but expects 1500
  - `discountMinor(10000, 2010)` returns 1000 but expects 1500

**Fix:** Change `>` to `>=` in the threshold check.

## Design Issues

### 2. Hardcoded Reference Date
**Severity:** High

The code hardcodes the reference date as `'2026-09-01'` for calculating membership years:
```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

**Issues:**
- Not flexible; will be incorrect after 2026-09-01
- Inconsistent with typical date handling patterns
- Makes testing time-dependent behavior difficult
- Should use `new Date()` to get current date, or accept date as parameter

**Impact:** The calculation will become incorrect after the hardcoded date passes.

## Robustness Issues

### 3. Missing Input Validation
**Severity:** Medium

No validation for:
- Negative or zero subtotal values
- Invalid memberSince years (future dates, negative years)
- Non-integer subtotal values (though rounding handles this)
- memberSince as a non-numeric value

**Current behavior:** The function silently computes results regardless of input validity.

### 4. Implicit Type Assumptions
**Severity:** Low

The function assumes:
- `memberSince` is an integer year (e.g., 2021)
- `subtotalMinor` is a non-negative number
- No error handling if these assumptions are violated

## Minor Issues

### 5. Comment-Code Mismatch
The comment states "Orders over the threshold get the higher rate" but doesn't clarify that orders **at exactly** the threshold should also get the higher rate (based on test expectations).

### 6. Hardcoded Minor Units
The threshold and calculations use "minor" units (likely cents), but this is implicit. No documentation explains the unit system or why it's called "minor."

## Positive Aspects

- Clean, concise implementation
- Correct loyalty cap logic (5-year maximum)
- Proper use of `Math.round()` for currency calculations
- Straightforward algorithm easy to understand

## Verification Summary

I verified:
- ✓ Code structure and algorithm logic
- ✓ Test execution (3 of 4 fail with specific assertion errors)
- ✓ Root cause analysis (threshold boundary bug confirmed)
- ✓ Calculations manually verified (e.g., 10000 * 0.05 = 500, not 1000)
- ✓ Loyalty bonus calculations (correct capping and accumulation logic)
- ✓ Hardcoded date handling (confirmed as static reference)
