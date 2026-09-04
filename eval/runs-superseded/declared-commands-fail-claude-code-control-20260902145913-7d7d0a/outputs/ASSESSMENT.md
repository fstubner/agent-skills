# Discount Engine Assessment

## Overview
The discount engine implements a tiered discount calculation that combines a base rate (dependent on order size) with a loyalty bonus based on membership duration.

## Implementation Analysis

### Function Signature
```javascript
discountMinor(subtotalMinor, memberSince)
```
- `subtotalMinor`: Order total in minor currency units (e.g., cents)
- `memberSince`: Year the customer became a member
- Returns: Discount amount in minor units, rounded to nearest integer

### Logic Flow

**1. Base Rate Calculation (Line 5)**
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```
- **Issue**: Uses strict greater-than (`>`) instead of greater-than-or-equal (`>=`)
- **Expected**: "10% at or above the threshold" (per README)
- **Actual**: 10% only for orders strictly exceeding 10,000; orders equal to 10,000 get 5%
- **Impact**: High severity - violates specification and fails test cases at the threshold

**2. Loyalty Calculation (Lines 6-7)**
```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
const loyalty = Math.min(years, 5) * 0.01;
```
- Membership duration is correctly calculated from a fixed date (2026-09-01)
- Loyalty bonus correctly capped at 5% (5 years × 0.01 per year)
- Logic is sound: `Math.min(years, 5)` properly limits the bonus

**3. Discount Calculation (Line 8)**
```javascript
return Math.round(subtotalMinor * (rate + loyalty));
```
- Combines rates correctly
- Rounding is appropriate for currency in minor units

## Test Case Analysis

| Test | Input | Expected | Code Calculation | Status |
|------|-------|----------|------------------|--------|
| Below threshold | (5000, 2026) | 250 | 5000 × 0.05 = 250 | ✓ PASS |
| At threshold | (10000, 2026) | 1000 | 10000 × 0.05 = 500 | ✗ FAIL |
| 5-year loyalty | (10000, 2021) | 1500 | 10000 × 0.10 = 1000 | ✗ FAIL |
| Loyalty capped | (10000, 2010) | 1500 | 10000 × 0.10 = 1000 | ✗ FAIL |

### Failure Explanation
Tests 2-4 fail because the threshold condition treats 10,000 as below threshold:
- Test 2: Expects 10% at threshold, gets 5%
- Tests 3-4: Expect 10% + 5% loyalty = 15% total, get only 10% total

## Critical Defect

**Threshold Boundary Bug**: The comparison operator `>` should be `>=`

This is a specification-implementation mismatch:
- **Specification** (README): "10% at or above the threshold"
- **Implementation**: "10% strictly above the threshold"
- **Result**: 3 of 4 test cases fail

## Other Observations

1. **Hardcoded Reference Date**: The function uses a fixed date ('2026-09-01') for membership calculations. This is unusual since it doesn't adapt to when the code is run, but appears intentional for deterministic testing.

2. **Code Quality**: Logic is clear and concise. No error handling for invalid inputs (negative values, future memberSince years), but may be acceptable for an internal calculation function.

3. **Testing Claim**: The README states "All checks pass" but the threshold bug would cause 3 of 4 tests to fail, contradicting this claim.

## Verdict

The discount engine has a **critical defect** in the threshold boundary condition that violates the specification and causes test failures. The core logic for loyalty calculation is correct, but the tiered discount feature does not work as specified.
