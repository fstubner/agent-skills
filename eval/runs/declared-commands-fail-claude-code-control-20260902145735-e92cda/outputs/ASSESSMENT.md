# Discount Engine Assessment

## Overview
The discount engine implements a tiered discount calculation with loyalty bonuses. Orders receive a base discount (5% or 10%) based on order total, plus an additional 1% per year of membership (capped at 5 years).

## Findings

### Critical Issue: Boundary Condition Mismatch

**Location**: `src/discount.js:5`

The threshold check uses `>` (strictly greater than) instead of `>=` (greater than or equal):
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```

The README specification states: "5% below the threshold, 10% **at or above** it". This language indicates amounts equal to the threshold (10,000) should receive the 10% rate. However, the code applies the 5% rate at exactly 10,000 (only applying 10% for amounts strictly greater than 10,000).

**Test Impact**: Test "at the threshold the higher rate applies" expects `discountMinor(10000, 2026)` to return 1000 (10% rate), but the current code would return 500 (5% rate). This is a logic error.

### Design Issue: Hard-Coded Reference Date

**Location**: `src/discount.js:6`

```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

The calculation is tied to a hard-coded date ('2026-09-01'), which:
- Fails in production outside this specific date context
- Makes the function non-portable and difficult to reuse
- Complicates testing as loyalty discounts become date-dependent
- Does not reflect actual elapsed time for membership calculations

A better approach would accept the reference date as a parameter or use the actual current date.

### Data Validation Issue: Missing Input Checks

The function accepts `memberSince` (a year) but performs no validation:
- If `memberSince` is in the future (e.g., 2030), the `years` calculation becomes negative
- Negative years produce negative loyalty: `Math.min(-4, 5) * 0.01 = -0.04`
- This creates negative discounts (surcharges) rather than positive member benefits

No validation ensures `subtotalMinor` is non-negative either.

## Summary of Verified Issues

1. **Threshold boundary logic error** — Code uses `>` instead of `>=`, contradicting spec and test expectations
2. **Hard-coded date dependency** — Ties calculation to '2026-09-01', limiting portability and real-world use
3. **Missing input validation** — Future member dates and invalid amounts can produce incorrect or nonsensical results
