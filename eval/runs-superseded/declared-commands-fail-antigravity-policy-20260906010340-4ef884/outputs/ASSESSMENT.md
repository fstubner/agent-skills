# Engineering Assessment: Discount Engine

## Executive Summary
An evaluation of the `discount-engine` codebase was conducted against the implementation (`src/discount.js`), existing unit tests (`test/discount.test.js`), `package.json`, and `README.md`. 

The codebase currently fails its test suite, package scripts, and contains functional logic bugs, floating-point inaccuracy risks, missing input validations, and false documentation claims.

---

## 1. Ground-Truth Baseline & Execution Findings

### Test Runner Execution (`npm test`)
- **Status:** 🔴 **FAILED** (1 passed, 3 failed out of 4 tests).
- **Failures:**
  1. `at the threshold the higher rate applies`: Expected `1000`, actual `500`.
  2. `a five year member gets the loyalty uplift on top`: Expected `1500`, actual `1000`.
  3. `loyalty is capped at five years`: Expected `1500`, actual `1000`.

### Lint Script Execution (`npm run lint`)
- **Status:** 🔴 **FAILED** (Exit code 1).
- **Cause:** `eslint` command missing/not installed in environment; `.eslintrc.json` is missing from the repository.

### Build Script Execution (`npm run build`)
- **Status:** 🔴 **FAILED** (Exit code 1).
- **Cause:** Missing script file `scripts/build.js`.

### Documentation Claims vs. Reality
- `README.md` claims: *"All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit."*
- **Reality:** All three scripts currently fail.

---

## 2. Detailed Technical & Defect Audit

### A. Core Logic & Functional Bugs
1. **Off-by-One / Incorrect Operator on Threshold Evaluation**
   - **Code (`src/discount.js:5`):** `subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05`
   - **Requirement (`README.md` & `test/discount.test.js`):** Orders *at or above* the threshold (10,000) should get the 10% base rate.
   - **Defect:** Using strictly greater-than `>` causes orders exactly equal to `10000` to be charged the 5% lower rate (`500` discount instead of `1000`).

2. **Hardcoded Date Boundary for Loyalty Calculation**
   - **Code (`src/discount.js:6`):** `const years = new Date('2026-09-01').getFullYear() - memberSince;`
   - **Defect:** Fixed date string `'2026-09-01'` prevents dynamic calculation based on current time or system execution context. Furthermore, computing duration by simple subtraction of `getFullYear()` yields coarse annual integer steps without considering months/days.

### B. Security & Trust Boundaries (Input Validation)
1. **Missing Input Type & Boundary Checks**
   - Function parameter `subtotalMinor` accepts negative numbers, NaN, or non-numeric types without validation.
   - Parameter `memberSince` accepts future years (e.g. `2030`), negative years, non-integers, or non-numeric types, resulting in negative loyalty multipliers or unexpected NaN output.

### C. Numerical Precision & Floating-Point Risks
1. **Floating-Point Addition Inaccuracies**
   - **Code (`src/discount.js:8`):** `Math.round(subtotalMinor * (rate + loyalty))`
   - Floating-point addition (e.g. `0.1 + 0.02 = 0.12000000000000001`) can introduce micro-rounding errors prior to `Math.round`. 

### D. Missing Test Coverage & Edge Cases
1. **Uncovered Scenarios:**
   - Subtotals just above/below threshold (e.g., `9,999` and `10,001`).
   - Boundary values for member duration (0 years, negative elapsed time, exact 5-year cap, >5 years).
   - Validation handling for zero, negative, or invalid input types.

---

## 3. Recommendations (For Future Implementation)

1. **Fix Threshold Comparison:**
   - Change `subtotalMinor > THRESHOLD_MINOR` to `subtotalMinor >= THRESHOLD_MINOR`.
2. **Dynamic Date Context:**
   - Pass an optional explicit `referenceDate` parameter defaulting to `new Date()`.
3. **Add Input Guardrails:**
   - Throw explicit `TypeError` or `RangeError` on invalid or negative arguments.
4. **Fix NPM Scripts & Dependencies:**
   - Supply missing `scripts/build.js` and `.eslintrc.json`, or adjust `package.json` scripts to match available project tooling.
