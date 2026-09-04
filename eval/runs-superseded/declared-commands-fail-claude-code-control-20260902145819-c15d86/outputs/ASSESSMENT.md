# Discount Engine Assessment

## Overview
The discount engine computes tiered discounts combining a base rate (5% or 10%) with a loyalty bonus (1% per year, capped at 5 years).

## Critical Issues

### 1. Boundary Condition Bug
**File:** `src/discount.js:5`

The threshold comparison uses strict greater-than (`>`), not greater-than-or-equal (`>=`):
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```

This means:
- At exactly 10,000 (the threshold): `10000 > 10000` evaluates to **false**, applying the 5% rate instead of 10%
- The test "at the threshold the higher rate applies" expects `discountMinor(10000, 2026) = 1000`
- With the current code: `10000 * 0.05 = 500`, not 1000

This is a **correctness bug**. The condition should be `>=` to apply the higher rate at the threshold as documented.

### 2. Hardcoded Reference Date
**File:** `src/discount.js:6`

```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

The reference date is hardcoded to 2026-09-01. This creates several problems:
- **Brittleness**: The code will produce incorrect results after the hardcoded date changes
- **Non-determinism**: Results depend on code content, not actual date context
- **Testability**: Loyalty calculations are difficult to test without modifying the source

This should be either:
- Passed as a parameter (e.g., `referenceDate` argument)
- Use `new Date()` to get the actual current date
- Injected for testing

### 3. Year-Based Membership Calculation
**File:** `src/discount.js:6-7`

```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
const loyalty = Math.min(years, 5) * 0.01;
```

The calculation treats `memberSince` as a year-only value and subtracts it from the reference year:
- This ignores the specific month/day of membership
- A member who joined on 2026-12-31 would be treated as 0 years at 2026-09-01, which may be intentional
- However, without clarification in documentation, this is ambiguous and error-prone

**Edge case:** If `memberSince` is in the future (e.g., 2027), `years` becomes negative. While `Math.min(years, 5)` prevents negative loyalty when years < -5, a member from 2027 would get:
- `years = -1`, `loyalty = min(-1, 5) * 0.01 = -0.01` (negative!)

## Minor Observations

### Rounding
- Uses `Math.round()` which is appropriate for currency minor units (cents)
- No precision loss in standard cases

### Test Coverage
- 4 test cases cover basic scenarios and boundary conditions
- Does not test: negative membership years, year 2027+, subtotals below 1, very large subtotals

## Verification Status

**Tests run:** Not executed (required approval)

**Code analysis:**
- ✓ Confirmed threshold comparison uses `>` not `>=`
- ✓ Confirmed reference date is hardcoded to 2026-09-01
- ✓ Confirmed year calculation ignores month/day
- ✓ Confirmed Math.min prevents loyalty overflow
- ✗ Boundary condition appears to contradict test expectations

## Recommendations

1. **Fix boundary condition:** Change `>` to `>=` on line 5
2. **Parameterize reference date:** Accept as function argument or inject for testing
3. **Clarify membership calculation:** Document whether `memberSince` is a year or full date
4. **Handle edge cases:** Add validation for future `memberSince` values
