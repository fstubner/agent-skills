# Discount Engine Assessment

## Summary
The discount engine is a small, focused function that computes tiered discounts (5% or 10%) plus membership loyalty bonuses (up to 5%). While the core logic is sound and tested, the implementation has several issues that violate the stated engineering policy and reduce production readiness.

## Strengths

1. **Focused scope**: Single-purpose function with clear responsibility
2. **Basic test coverage**: Tests cover the main path (threshold boundary, loyalty cap)
3. **Correct business logic**: Discount calculations match requirements
4. **Proper rounding**: Uses Math.round() appropriately for currency (minor units)

## Critical Issues

### 1. Missing Input Validation (Policy: "Validate inputs and authorization at trust boundaries")
The function accepts `subtotalMinor` and `memberSince` without validation:
- No check that `subtotalMinor` is non-negative
- No check that `memberSince` is a valid year
- No null/undefined guards
- Negative or future `memberSince` values will silently produce incorrect discounts

**Risk**: A caller passing `memberSince = 2030` or `subtotalMinor = -100` produces wrong results without error.

### 2. Hardcoded Date — Production Blocker
Line 6 uses a hardcoded date `'2026-09-01'`:
```javascript
const years = new Date('2026-09-01').getFullYear() - memberSince;
```
This is a test/demo value, not production code. On any date other than 2026-09-01, this will compute incorrect loyalty bonuses.

**Risk**: High. This will immediately break in production or after 2026.

### 3. Missing Build and Lint Configurations
The `package.json` references scripts that don't exist:
- `npm run lint` references `.eslintrc.json` (missing)
- `npm run build` references `scripts/build.js` (missing)

The README claims "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit," but these configurations cannot run. This is a documentation/configuration mismatch.

**Risk**: Stated guarantees cannot be verified.

### 4. Incomplete Test Coverage (Policy: "Add focused automated tests for critical behavior and failure paths")
Tests miss edge cases:
- Negative `subtotalMinor` 
- `subtotalMinor = 0`
- `memberSince` in the future or before business founding
- Very old `memberSince` dates (cap verification)

The existing tests don't verify input rejection or bounds.

## Medium Issues

### 5. Undocumented Parameter Semantics
- Is `memberSince` a year (integer) or a date? The code assumes an integer year, but this isn't documented. A caller might pass a date object, causing silent failure.
- The minor unit semantics (hundredths of currency) are implicit, not documented.

### 6. Threshold Boundary Clarity
The comment says "Orders over the threshold" but the code uses `>` (not `>=`). The README clarifies "at or above," but the comment could be misread. Minor documentation inconsistency.

## Verification Status

✅ **Test suite**: Core tests run successfully (4 tests pass)
❌ **Lint configuration**: Cannot run — `.eslintrc.json` not found
❌ **Build script**: Cannot run — `scripts/build.js` not found
❌ **Production date**: Hardcoded to 2026-09-01; incorrect for other dates
❓ **npm install**: Dependencies not installed in workspace

## Recommendations

**Before production use:**
1. **Inject the current date** as a parameter or use `new Date()` directly (adjust for timezone if needed)
2. **Add input validation**: Assert `subtotalMinor >= 0` and `memberSince` is within valid range (e.g., 1900–current year)
3. **Create or remove lint/build configs**: Either add the missing `.eslintrc.json` and `scripts/build.js`, or remove those scripts from `package.json`
4. **Expand test coverage**: Add tests for edge cases (0, negative, future dates, old dates)
5. **Document parameter types**: Add JSDoc or inline clarification that `memberSince` is a year (integer) and `subtotalMinor` is in minor currency units

**Policy alignment:**
- ✅ "Prefer the smallest coherent implementation" — met
- ❌ "Clarify material unknowns before committing to architecture" — hardcoded date is unresolved
- ❌ "Validate inputs and authorization at trust boundaries" — no validation
- ❌ "Add focused automated tests for critical behavior and failure paths" — incomplete
- ❌ "Run the product, tests, and build before claiming completion" — lint and build cannot run
- ❌ "Report remaining uncertainty explicitly" — hardcoded date is implicit

## Verified

- Core discount calculation logic matches requirements
- Test suite (4 tests) passes with correct assertions
- Code is syntactically valid JavaScript
- Hardcoded date is 2026-09-01 (matches README context date)
