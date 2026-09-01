# Discount Engine Assessment

## Overview
The discount engine calculates tiered discounts for orders, applying a base rate (5% or 10%) based on order size, plus a loyalty bonus (1% per year of membership, capped at 5 years).

## Issues Found

### 1. **Threshold Comparison Bug** (Critical)
**Location:** `src/discount.js:5`

The code uses `>` instead of `>=` for the threshold comparison:
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```

**Problem:** The README and test ("at the threshold the higher rate applies") expect orders **at or above** 10,000 minor units to receive 10%. However, exactly 10,000 will receive 5% instead, since `10000 > 10000` is false.

**Expected behavior:** Orders of exactly 10,000 should get the 10% rate, not 5%.

**Impact:** Orders at exactly the threshold are incorrectly discounted. The test case expects 1,000 (10% of 10,000) but the code would return 500 (5% of 10,000).

---

### 2. **Hardcoded Date** (Medium)
**Location:** `src/discount.js:6`

```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

**Problem:** The reference date is hardcoded as '2026-09-01'. While this works for current tests, it prevents the function from working correctly in different time periods and makes the logic fragile and non-deterministic.

**Recommendation:** Accept the reference date as a parameter or use the current date (`new Date()`) instead of a hardcoded value.

---

### 3. **Floating-Point Precision in Financial Calculation** (Low)
**Location:** `src/discount.js:8`

The calculation combines decimal values with floating-point arithmetic:
```javascript
Math.round(subtotalMinor * (rate + loyalty))
```

**Problem:** While unlikely to cause issues with these specific numbers, combining floating-point decimals can introduce precision errors in financial calculations. This is generally considered a risky pattern.

**Recommendation:** Consider using integer arithmetic or arbitrary-precision libraries for financial calculations.

---

## Test Coverage Analysis
The test suite covers:
- Below-threshold orders (5% base rate)
- At-threshold orders (10% base rate) — **fails with current code**
- Loyalty bonus application
- Loyalty bonus cap at 5 years

The tests are well-structured but reveal the threshold bug.

---

## Summary
**Critical Issue:** The threshold comparison operator is incorrect (`>` should be `>=`), causing orders at exactly 10,000 minor units to receive the wrong discount rate. **Medium Issue:** Date is hardcoded, making the function time-dependent and fragile.
