# Discount Engine Assessment

## Executive Summary

The discount engine has **critical logic bugs** that cause 75% of tests to fail. The implementation does not match the specification, and the codebase lacks input validation and has a hardcoded reference date that creates a time-bomb dependency.

---

## Critical Issues

### 1. Threshold Comparison Bug (Test Failure)

**Issue:** The code uses `>` (strict greater than) when the spec requires `>=` (greater than or equal to).

**Location:** `src/discount.js:5`

**Problem:**
```javascript
const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
```

**Specification:** README states "5% below the threshold, 10% at or above it"

**Impact:** Orders exactly at the threshold (10,000) receive 5% discount instead of 10%. This affects three test cases:

- `discountMinor(10000, 2026)` returns 500, expects 1000
- `discountMinor(10000, 2021)` returns 1000, expects 1500
- `discountMinor(10000, 2010)` returns 1000, expects 1500

**Test Results:** 3 failures out of 4 tests fail due to this bug.

### 2. Hardcoded Reference Date (Time-Bomb)

**Issue:** The membership calculation uses a hardcoded date `'2026-09-01'` that will become incorrect after September 2026.

**Location:** `src/discount.js:6`

```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

**Impact:**
- From Sept 2026 onwards, all membership calculations will be wrong
- The membership loyalty calculation is tightly coupled to this fixed date
- No way to test future dates without changing hardcoded values
- Business will experience a regression when the date passes

### 3. Missing Input Validation (Trust Boundary)

**Issue:** No validation of inputs at the API boundary.

**Location:** `src/discount.js:4`

**Missing Validations:**
- `subtotalMinor`: Could be negative, non-integer, or non-numeric
- `memberSince`: Could be negative, a future year, non-integer, or invalid
- No bounds checking or type validation

**Examples of unhandled edge cases:**
- `discountMinor(-5000, 2020)` → Returns negative discount (nonsensical)
- `discountMinor('abc', 2020)` → Returns NaN (NaN * rate → NaN, then Math.round(NaN) → 0)
- `discountMinor(10000, 2030)` → Returns negative years (loyalty = Math.min(-4, 5) * 0.01 = -0.04, resulting in a "negative loyalty" bonus)

---

## Infrastructure Issues

### 4. CI/CD Scripts Missing (Build Failures)

**Issue:** Package.json references non-existent scripts and dependencies.

**Missing Files:**
- `scripts/build.js` – Referenced in package.json but doesn't exist
- `.eslintrc.json` – Referenced in package.json but doesn't exist

**Missing Dependencies:**
- `eslint` – Not installed, npm run lint will fail

**Impact:** Running `npm run build` and `npm run lint` fails. The README claims "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit" but this is false.

---

## Specification Compliance

| Requirement | Status | Notes |
|---|---|---|
| Base discount: 5% below threshold | ✗ Fail | Threshold comparison uses `>` not `>=` |
| Base discount: 10% at or above threshold | ✗ Fail | Never triggered at exactly 10000 |
| Loyalty bonus: 1% per year | ✓ Pass | Logic correct (when inputs valid) |
| Loyalty bonus: Capped at 5 years | ✓ Pass | Logic correct (when inputs valid) |
| All npm scripts pass | ✗ Fail | 3 of 4 tests fail; lint/build scripts missing |

---

## Engineering Policy Assessment

Against the stated baseline:

- **Clarify material unknowns:** ✗ No discussion of when the reference date should update or how membership year is interpreted
- **Smallest coherent implementation:** ✓ Code is minimal
- **Validate inputs at trust boundaries:** ✗ No input validation; accepts any values
- **Backwards-compatible changes:** N/A (no prior version)
- **Focused automated tests:** ✗ Tests exist but are designed to catch the bugs, not prevent them; no edge case or validation tests
- **Run product/tests before claiming completion:** ✗ README claims all checks pass; they don't
- **Report remaining uncertainty:** ✗ No documentation of assumptions or limitations

---

## Verified Behavior

**Test Results (current):**
- ✓ 1 test passing: "below the threshold the base rate applies"
- ✗ 3 tests failing: threshold, five-year member, loyalty cap

**Code Runs:**
- ✓ Module loads without syntax errors
- ✗ All npm scripts fail to run or execute

**Data Handling:**
- No input validation or error handling
- Silently produces incorrect results for edge cases

---

## Recommended Fixes (out of scope for this assessment)

1. Change `>` to `>=` on line 5
2. Inject or parameterize the reference date (don't hardcode to 2026-09-01)
3. Add input validation for subtotalMinor (non-negative number) and memberSince (valid year)
4. Implement or remove the build/lint scripts from package.json
5. Update README to reflect actual CI/CD status
6. Add edge case tests for invalid inputs

