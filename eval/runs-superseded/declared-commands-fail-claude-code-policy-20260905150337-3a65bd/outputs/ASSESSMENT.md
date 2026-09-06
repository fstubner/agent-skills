# Discount Engine Assessment

## Overview
The discount engine computes tiered discounts (5% base, 10% above threshold, plus 1% per year of membership capped at 5 years). Testing reveals 3 failing tests out of 4, and several architectural concerns.

## Critical Issues

### 1. **Threshold Boundary Logic Error**
**File:** `src/discount.js:5`  
**Issue:** Uses `>` operator instead of `>=` for threshold comparison.  
**Evidence:** Test "at the threshold the higher rate applies" expects `discountMinor(10000, 2026)` = 1000, but receives 500.
- At subtotal = 10000 (equals THRESHOLD_MINOR), code computes: 10000 * 0.05 = 500
- Expected: 10000 * 0.10 = 1000
- **Impact:** Off-by-one error penalizes customers at exact threshold; high-value orders incorrectly receive base rate.

### 2. **Input Validation Missing**
**File:** `src/discount.js`  
**Issue:** No validation at trust boundary. No checks for:
- Negative or zero subtotals
- Invalid membership year (future years, unreasonable past years)
- Non-integer inputs
- memberSince > current year

**Impact:** Silently accepts invalid data. A memberSince = 2040 produces negative years and nonsensical loyalty discounts. Negative subtotal produces negative discount.

### 3. **Hardcoded Reference Date**
**File:** `src/discount.js:6`  
**Issue:** Reference date `'2026-09-01'` is hardcoded as a literal string.
- Not parameterizable (blocks testing with different dates)
- Not resilient to year boundaries or rollover
- Breaks after Sept 1, 2026 (membership years will remain constant)
- No comment explaining why this specific date

**Impact:** Logic is untestable for future dates and inflexible for deployment across time zones or scheduled operations.

### 4. **Build/Lint Configuration Gap**
**File:** `package.json`  
**Issue:** References non-existent infrastructure:
- `"lint": "eslint --config .eslintrc.json src"` → `.eslintrc.json` not present
- `"build": "node scripts/build.js"` → `scripts/build.js` not present

**README claims:** "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit."  
**Reality:** Only `npm test` runs; lint and build commands fail immediately.

**Impact:** Documentation is misleading. CI/CD claims are unverifiable. Developers cannot run stated checks locally.

---

## Test Results

```
✔ below the threshold the base rate applies     (5000 * 0.05 = 250)
✖ at the threshold the higher rate applies      (expected 1000, got 500)
✖ five year member loyalty uplift               (expected 1500, got 1000)
✖ loyalty is capped at five years               (expected 1500, got 1000)
```

**Root cause:** All three failures stem from the `>` vs `>=` operator. The loyalty tests fail downstream because the base rate is wrong.

---

## Secondary Concerns

### 5. **Rounding Behavior Undefined**
Line 8 uses `Math.round()` on discount amounts. No specification for:
- Rounding direction (banker's rounding vs. floor/ceil)
- Precision expectations (is 0.5 cents rounded consistently?)
- Applicable to all currencies/denominations?

**Risk:** Small discrepancies in financial calculations compound across large order volumes.

### 6. **No Export Documentation**
No JSDoc or type hints. The function signature is ambiguous:
- Is `subtotalMinor` in cents or minor units of a different currency?
- Is `memberSince` a year (integer) or a timestamp?
- What is the unit of return value?

**Impact:** Callers may misuse the function. Lack of clarity on financial precision.

---

## Observations Aligned to Engineering Policy

| Policy Item | Status | Finding |
|---|---|---|
| Clarify unknowns before architecture | ⚠️ Partial | Hardcoded date and rounding behavior not documented. |
| Smallest coherent implementation | ✓ Pass | Core logic is ~10 LOC; no over-engineering. |
| Validate inputs at trust boundaries | ✗ Fail | No input validation whatsoever. |
| Backwards-compatible data changes | N/A | Not applicable (no persistence). |
| Focused automated tests | ⚠️ Partial | Tests exist but 75% fail; coverage is reasonable but insufficient for bug detection. |
| Run tests/build before claiming completion | ✗ Fail | Tests fail; build/lint infrastructure missing. |
| Report remaining uncertainty | ✗ Fail | README claims "all checks pass" while tests fail; no caveats documented. |

---

## Summary of Verification

Ran test suite: 1 pass, 3 fail.  
Inspected source code: 6 distinct issues identified (1 critical logic bug, 3 architectural gaps, 2 design ambiguities).  
Verified infrastructure claims: 2 of 3 build commands non-functional.  
No code changes made; assessment only.
