# Assessment: orders-core Package

## Executive Summary

The `orders-core` package is a small, functional utility library for order pricing and customer management. It has passing tests and works correctly for happy-path inputs. However, it has critical gaps in input validation, incomplete test coverage, and architectural concerns that should be addressed before reuse in other systems.

**Verdict:** Not ready for reuse without addressing material issues in input validation and test coverage.

---

## Strengths

1. **Small, focused scope**: Three clear modules (pricing, customers, util) with defined responsibilities.
2. **Tests exist and pass**: Both test cases pass successfully (weekday and weekend pricing).
3. **Correct happy-path behavior**: Works as intended when given valid inputs in the expected format.
4. **Simple dependencies**: No external npm dependencies beyond Node's built-in test framework.

---

## Critical Issues

### 1. Missing Input Validation at Trust Boundaries

**Problem:** Public functions accept no validation of inputs, causing crashes or silent failures.

**Examples:**
- `priceFor({ quantity: 1 })` crashes when `date` is undefined (TypeError at parseDate)
- `parseDate("invalid")` returns `{ year: NaN, month: undefined, day: undefined }` silently
- `isWeekend("2026-13-45")` returns `true` with invalid day/month values, no error
- `formatMoney("abc")` returns `"NaN.NaN"` instead of failing
- `slugify(123)` crashes with TypeError
- `chunk([1,2,3], 0)` causes infinite loop (heap out of memory)

**Impact:** Callers can accidentally pass malformed data that either crashes the process or produces garbage results without warning.

**Engineering policy violation:** "Validate inputs and authorization at trust boundaries."

---

### 2. Insufficient Test Coverage

**Problem:** Only `pricing.js` has tests. The other modules are untested.

- `customers.js` functions (`findCustomer`, `customerSlug`) have no tests
- `util.js` functions mostly untested except through pricing tests
- No tests for error paths or edge cases
- No tests for null/undefined/wrong-type inputs

**Impact:** Bugs in customers.js or util.js would not be caught. Silent failures in util.js functions (like parseDate) are undetected.

**Engineering policy violation:** "Add focused automated tests for critical behavior and failure paths."

---

### 3. Circular Dependencies

**Problem:** `util.js` imports from `pricing.js` and `customers.js`, while those modules import from `util.js`.

```
util.js → pricing.js ↘
util.js → customers.js ↗
pricing.js, customers.js → util.js
```

**Impact:** This dependency structure is fragile. While Node.js can handle it in this case, it:
- Makes the modules harder to test in isolation
- Creates initialization order dependencies
- Makes future refactoring risky
- Would break if any module tries to use top-level code at import time

---

### 4. Hard-Coded Customer Data

**Problem:** `customers.js` has a hard-coded `CUSTOMERS` array with two customers.

```javascript
const CUSTOMERS = [
  { id: 'c1', name: 'Ada Fielding' },
  { id: 'c2', name: 'Bo Marsh' },
];
```

**Impact:** 
- Not reusable in systems with different customers
- Cannot be configured or extended by consumers
- No mechanism to load customers from database/config
- Unclear if this is meant as demo data or the actual API

---

### 5. Unclear API Contracts

**Problem:** Some functions have ambiguous intended use.

- `describeOrder()` couples pricing and customer lookup—is this a core API or a helper for a specific UI?
- `retry()` is generic but never used in the package
- The main export (`util.js`) includes mix of utilities, formatting, and domain logic
- No documentation on which functions are stable APIs vs internal helpers

**Impact:** When splitting this for reuse, unclear what's safe to depend on.

---

## Material Unknowns

1. **Customer data management**: Should this package own customer data, or accept it as a dependency?
2. **Date handling**: Is the package intended to work only with YYYY-MM-DD string format, or should it support other formats or Date objects?
3. **Money representation**: Is cents (minor) the only supported representation, or should it handle dollars too?
4. **Error handling strategy**: Should invalid inputs throw errors or return defaults?
5. **Breaking API changes**: Will this package be deployed independently? How will callers handle breaking changes?

---

## Issues by Component

### customers.js
- ✗ No input validation on `findCustomer(id)` or `customerSlug(id)`
- ✗ No tests
- ✗ Hard-coded customer data not configurable
- ✓ Logic is simple and works correctly for valid inputs

### pricing.js
- ✗ No validation: `priceFor()` crashes if `date` or `quantity` missing
- ✓ Has passing tests for happy path
- ✗ Missing tests for invalid/missing fields
- ✓ Logic is correct for valid inputs

### util.js
- ✗ `parseDate()` does not validate date ranges (allows month 13, day 45)
- ✗ `parseDate()` crashes on undefined input instead of failing gracefully
- ✗ `formatMoney()` accepts any type and produces garbage for non-numbers
- ✗ `slugify()` crashes on non-string input
- ✗ `chunk()` crashes with infinite loop on size 0 or negative
- ✓ `isWeekend()` works correctly given valid parseDate output
- ✓ Simple array chunking logic is sound
- ✓ `retry()` logic is correct but unused

### Tests
- ✓ Both existing tests pass
- ✗ Only 2 test cases for entire package
- ✗ Only tests `priceFor()`, leaves other functions untested
- ✗ No tests for edge cases or invalid inputs

---

## Recommendations for Reusability

1. **Add input validation** to all public functions at module boundaries:
   - Validate types (string, number, object shape)
   - Validate date format and ranges
   - Return null or throw on invalid input, do not silently fail

2. **Expand test coverage** to include:
   - All functions in customers.js and util.js
   - Invalid/missing field cases
   - Type mismatches
   - Boundary conditions (chunk size 0, negative quantities, empty strings)

3. **Resolve circular dependencies**:
   - Consider whether `describeOrder()` belongs in util.js or should be removed
   - Move shared constants/types to a separate module if needed
   - Ensure modules can be imported and used independently

4. **Document intended APIs**:
   - Clarify which functions are public vs internal
   - Document input/output types and constraints
   - Specify error handling behavior

5. **Address customer data ownership**:
   - Decide: does this package own customer data or accept it as parameter?
   - If it must own data, make it configurable (env var, config file, function parameter)
   - Add a function to register/update customers rather than hard-coding

6. **Error handling strategy**:
   - Choose: throw on bad input or return safe defaults?
   - Be consistent across all functions
   - Document the choice

---

## Verification Completed

- ✓ All files read and analyzed
- ✓ Tests executed (2/2 passed)
- ✓ Input validation tested (multiple failure modes found)
- ✓ Circular dependency structure mapped
- ✓ Public API surface examined
- ✓ Test coverage assessed
- ✓ No code changes made
