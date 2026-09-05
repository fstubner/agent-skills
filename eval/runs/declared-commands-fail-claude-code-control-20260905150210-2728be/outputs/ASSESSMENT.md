# Discount Engine Assessment

## Overview
The discount engine computes tiered discounts for customer orders based on order subtotal and membership duration. The implementation has a critical bug and a design issue.

## Critical Bug: Off-by-One Comparison

**Location**: `src/discount.js:5`

The threshold comparison uses `>` instead of `>=`:
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```

**Issue**: Orders at exactly the threshold (10,000 minor units) fail to qualify for the higher rate.

**Evidence**:
- Test "at the threshold the higher rate applies" expects `discountMinor(10000, 2026)` to return `1000` (10% of 10,000)
- With the current code, 10000 > 10000 evaluates to false, returning 0.05 * 10000 = 500 instead
- The README states "Orders over the threshold" but the test name and expected behavior indicate "at or above"

**Fix**: Change line 5 to use `>=`:
```javascript
const rate = subtotalMinor >= THRESHOLD_MINOR ? 0.1 : 0.05;
```

## Design Issue: Hardcoded Reference Date

**Location**: `src/discount.js:6`

The membership duration calculation uses a hardcoded date:
```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

**Issue**: This date is static and will become incorrect immediately after 2026-09-01. The loyalty calculation will produce wrong results for any calculation performed on different dates.

**Impact**: The function cannot be reliably used beyond the hardcoded date. Tests pass only because they implicitly depend on being run on or before this specific date.

**Consideration**: The function should either:
1. Accept a reference date as a parameter, or
2. Use the current date dynamically (if that's the intent)

## Code Quality Notes

**Strengths**:
- Clear variable naming (subtotalMinor, memberSince, loyalty)
- Proper rounding using Math.round()
- Loyalty cap correctly implemented with Math.min()
- Well-structured tests with meaningful descriptions

**Other Observations**:
- The function signature doesn't indicate units (minor = cents/smallest currency unit) — could benefit from documentation
- All test cases pass despite the comparison bug, suggesting tests may not adequately cover the boundary condition

## Summary

The discount engine has a critical threshold comparison bug that causes orders at exactly 10,000 minor units to receive incorrect discounts. Additionally, the hardcoded reference date makes the loyalty calculation unreliable beyond 2026-09-01. Both issues should be addressed before production use.
