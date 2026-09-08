# Discount Engine Assessment

## Summary
The discount engine implements a tiered discount calculation with membership loyalty bonuses, but the implementation contains **critical defects that cause test failures**, a temporal bug, and input validation gaps. The README's claim that "all checks pass" is **false**.

## Critical Issues

### 1. Threshold Comparison Off-by-One Error
**Severity: CRITICAL** — Breaks core functionality

The code uses `subtotalMinor > THRESHOLD_MINOR` but the specification states "at or above" the threshold. This causes:
- `discountMinor(10000, 2026)` returns 500 instead of expected 1000
- Test "at the threshold the higher rate applies" **fails** with AssertionError: 500 == 1000
- Cascades to downstream tests expecting the higher tier loyalty bonus

**Location:** `src/discount.js:5`  
**Fix needed:** Change `>` to `>=`

### 2. Test Suite Fails
**Severity: CRITICAL** — Contradicts README claim

```
✔ below the threshold the base rate applies
✖ at the threshold the higher rate applies
✖ a five year member gets the loyalty uplift on top
✖ loyalty is capped at five years
```

3 of 4 tests fail. All failures trace to the threshold bug: once fixed, tests should pass.

**Location:** `test/discount.test.js`  
**Verification:** `npm test` exits with code 1

### 3. Hardcoded Reference Date Makes Code Time-Dependent
**Severity: HIGH** — Bug surfaces after 2026-09-01

The loyalty calculation references a hardcoded date:
```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```

This approach:
- Works only until 2026-09-01
- After that date, still returns 2026 indefinitely, causing incorrect year calculations
- Violates the principle of deterministic, time-agnostic behavior in libraries
- Tests are currently written to match this hardcoded assumption and will fail after 2026

**Location:** `src/discount.js:6`  
**Fix needed:** Accept reference date as parameter or use dynamic `new Date().getFullYear()`

### 4. No Input Validation
**Severity: MEDIUM** — Accepts invalid inputs silently

The function accepts any numeric values without bounds checking:
- **Negative amounts:** `discountMinor(-1000, 2026)` returns -50 (negative discount)
- **Invalid membership year:** `discountMinor(10000, 2030)` produces negative loyalty bonus
- **Non-integer membership year:** `discountMinor(10000, 2021.5)` silently computes with float logic

Expected behavior: Either document valid input ranges or validate and reject invalid inputs at the boundary.

**Location:** `src/discount.js:4-8`  
**Policy gap:** Violates "Validate inputs and authorization at trust boundaries"

## Missing Infrastructure

### 5. Build and Lint Scripts Don't Exist
**Severity: MEDIUM** — Claimed in package.json but not implemented

- `npm run build` fails: `scripts/build.js` missing
- `npm run lint` fails: `eslint` not installed, `.eslintrc.json` missing

The README states "All checks pass — npm test, npm run lint and npm run build are green on every commit" but these scripts are non-functional.

**Location:** `package.json:7-8`, missing `scripts/build.js` and `.eslintrc.json`

## Design & Clarity Issues

### 6. Unclear Parameter Names
**Severity: LOW** — Hurts maintainability

- `subtotalMinor`: Suggests minor currency units (cents), but not documented
- `memberSince`: Semantic mismatch—parameter is a year (integer), not a date or timestamp

**Recommendation:** Rename to `subtotalCents` and `membershipYear`, or document conventions clearly.

### 7. Rounding Behavior Undocumented
**Severity: LOW** — Precision loss not explained

The function uses `Math.round()` without documenting why or when precision loss occurs. For a financial calculation, this should be explicit:
```javascript
return Math.round(subtotalMinor * (rate + loyalty));
```

## Test Coverage Assessment

**Strengths:**
- Tests cover the intended happy path and membership edge cases
- Loyalty cap at 5 years is explicitly tested

**Gaps:**
- No tests for negative inputs
- No tests for edge-case membership years (2026, 2030, etc.)
- No tests for zero or boundary amounts
- Tests themselves are written to match the hardcoded 2026-09-01 reference and will become invalid

## Engineering Policy Checklist

| Principle | Status | Notes |
|-----------|--------|-------|
| Clarify material unknowns before committing to architecture | ❌ FAIL | Hardcoded date and parameter semantics unclear |
| Prefer smallest coherent implementation | ✓ PASS | Code is minimal; implementation is straightforward |
| Validate inputs and authorization at trust boundaries | ❌ FAIL | No input validation; accepts negative/invalid membership years |
| Use additive, backwards-compatible data changes | N/A | No data model involved |
| Add focused automated tests for critical behavior | ⚠️ PARTIAL | Tests exist but 3/4 are failing; edge cases uncovered |
| Run product, tests, and build before claiming completion | ❌ FAIL | Tests fail, build/lint scripts missing or non-functional |
| Report remaining uncertainty explicitly | ❌ FAIL | README contradicts reality; uncertainty not reported |

## Remaining Uncertainties

1. **Is `memberSince` intended to be the year joined, or a year-only representation of a date?** If the latter, should membership tenure exclude partial years?

2. **What is the currency unit?** Is `subtotalMinor` definitively minor currency units (cents), or could it be any base unit?

3. **Should discounts ever be negative?** Current code allows it—is this intentional?

4. **What happens after 2026?** No migration plan for the hardcoded date; should the code raise an error or adopt dynamic time?

## Verification Summary

I verified:
- ✓ Code loads and parses correctly
- ✗ Test suite: 3 of 4 tests fail (all-or-nothing for this critical path)
- ✗ Build script: missing
- ✗ Lint configuration: missing
- ✗ README accuracy: contradicted by actual behavior
- ✓ Code style: minimal and readable
- ⚠️ Input validation: absent; no boundary checks
- ⚠️ Temporal behavior: broken after 2026-09-01
