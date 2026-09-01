# Discount Engine Assessment

## Overview
The discount engine is a 9-line function that computes tiered discounts based on order subtotal and membership duration. It applies a base rate (5% below threshold, 10% at or above), plus a loyalty bonus (1% per year, capped at 5 years).

## Engineering Policy Evaluation

### 1. Clarify Material Unknowns ⚠️ **CRITICAL**
**Status: FAILED**

- **Hardcoded reference date**: The function contains `new Date('2026-09-01').getFullYear()` embedded in the production code. This couples the function to a fixed point in time and will produce incorrect results after 2026. This should be:
  - Passed as a parameter, or
  - Injected as a dependency, or
  - Obtained from a system clock at call time

- **Unclear parameter semantics**: 
  - `subtotalMinor`: Does not clarify that this is a currency amount in minor units (e.g., cents). The naming implies precision but the unit is ambiguous.
  - `memberSince`: Expected to be a year (integer), but the contract is undocumented. No type hints or JSDoc.

- **Rounding behavior**: The function uses `Math.round()` on the discount amount. When does this round up vs. down? What precision is expected downstream? Not documented.

### 2. Smallest Coherent Implementation ✓ **PASS**
**Status: ACCEPTABLE**

The core logic is minimal (7 lines of calculation) and fits the stated requirements. However:
- The hardcoded date violates coherence—it's a testing concern embedded in production code.
- Input validation is completely missing, which contradicts "coherent" (a coherent implementation handles its contract).

### 3. Validate Inputs at Trust Boundaries ✗ **CRITICAL**
**Status: FAILED**

No input validation whatsoever. The function will accept and compute on:
- Negative `subtotalMinor` (produces negative discounts, nonsensical)
- Non-numeric inputs (NaN propagates through calculations)
- Future years for `memberSince` (negative or zero loyalty bonus)
- Unreasonable values (e.g., memberSince = 1000)

This is a trust boundary—external input (order data, user records) enters here and should be validated.

### 4. Backwards-Compatible Data Changes ✓ **N/A**
**Status: NOT APPLICABLE**

A pure function with no persistent state. The hardcoded date is the only "state" issue, which is a breaking change concern rather than a rollout concern.

### 5. Focused Automated Tests ✗ **FAIL**
**Status: FAILED**

**Coverage present:**
- Happy path: below threshold (5%), at threshold (10%), loyalty uplift, loyalty cap ✓

**Coverage missing:**
- Edge cases: zero subtotal, negative subtotal, very large subtotal
- Invalid inputs: non-integer years, future membership dates, NaN, null
- Boundary conditions: exactly at THRESHOLD_MINOR (covered), one unit below (not covered)
- Precision: rounding behavior with fractional cent amounts
- Loyalty calculation: off-by-one years in edge cases (e.g., exactly 5 years vs. 4 years 364 days)

**No failure path tests**: What happens on invalid input? The function produces garbage silently rather than failing fast.

### 6. Run Tests, Build, Lint Before Completion ✗ **FAIL**
**Status: INCOMPLETE INFRASTRUCTURE**

- **Tests**: Only 4 tests present. Test suite covers only happy path.
- **Lint**: `.eslintrc.json` does not exist in workspace, but `package.json` references `npm run lint`. This will fail.
- **Build**: `scripts/build.js` does not exist in workspace, but `package.json` references `npm run build`. This will fail.
- **README claim**: "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit." — This claim is **unsupported**. The lint and build scripts will fail immediately.

### 7. Report Remaining Uncertainty ✓ **PASS**
**Status: ACCEPTABLE**

The README is explicit about test pass status, but overcommits on lint/build.

---

## Critical Issues

1. **🔴 PRODUCTION RISK: Hardcoded Date**
   - Function will produce incorrect loyalty calculations after 2026-09-01.
   - No deprecation path; breaking change unavoidable.
   - **Fix**: Accept date as parameter with sensible default.

2. **🔴 TRUST BOUNDARY: No Input Validation**
   - Accepts negative, non-numeric, or out-of-range inputs silently.
   - Produces nonsensical discounts without error.
   - **Fix**: Validate `subtotalMinor ≥ 0`, `memberSince` is integer year in reasonable range.

3. **🔴 INFRASTRUCTURE: Missing Lint/Build Config**
   - README claims checks pass, but required files don't exist.
   - Lint and build will fail on any commit attempt.
   - **Fix**: Add `.eslintrc.json` and `scripts/build.js` or remove from package.json.

## Minor Issues

4. **Parameter Semantics**: Undocumented contract on input types and units.
   - **Fix**: Add JSDoc with parameter types and ranges.

5. **Incomplete Test Coverage**: No edge cases, boundary conditions, or error paths.
   - **Fix**: Add tests for zero/negative amounts, invalid years, off-by-one loyalty years.

6. **Rounding Semantics**: No documentation of how fractional cents are handled.
   - **Fix**: Clarify rounding behavior in comments or JSDoc.

---

## Summary

The discount engine implements a simple algorithm correctly for happy-path scenarios. However, it violates three critical engineering principles:
- **Unknown material**: Hardcoded date breaks future use.
- **No input validation**: Silently computes on invalid data at a trust boundary.
- **Incomplete infrastructure**: Claims about lint and build pass are unsupported.

**Recommendation**: Before production use, (1) parameterize the date, (2) add input validation, (3) restore lint and build tooling or remove false claims from README.

