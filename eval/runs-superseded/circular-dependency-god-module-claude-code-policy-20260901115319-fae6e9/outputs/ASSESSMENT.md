# Assessment: orders-core Package

## Overview
`orders-core` is a Node.js ES module package providing pricing calculations, customer management, and shared utilities. It is positioned as a reusable library for order processing workflows.

**Package Size**: ~100 LOC across 3 source files + 12 LOC of tests.

---

## API Surface & Entry Point

**Main Entry**: `src/util.js` exports 7 functions:
- `formatMoney(minor)` — formats integer cents to currency string
- `describeOrder(order)` — generates order summary
- `slugify(text)` — converts text to URL slug
- `parseDate(value)` — parses 'YYYY-MM-DD' string to object
- `isWeekend(value)` — date string → boolean
- `chunk(rows, size)` — array chunking utility
- `retry(fn, times)` — retry helper

**Secondary Exports**:
- `src/pricing.js` exports `priceFor(order)` 
- `src/customers.js` exports `findCustomer(id)`, `customerSlug(id)`

**Concern**: Entry point is `util.js` (the "catch-all" module), but consumers needing only pricing or customers must still import from the specific modules. No barrel export or clear API boundary.

---

## Internal Structure & Cohesion

### Dependency Graph
```
util.js → pricing.js → util.js (isWeekend)
util.js → customers.js → util.js (slugify)
```

**Issue**: Circular dependency risk. `util.js` imports from `pricing.js` and `customers.js`, and they import back from `util.js`. This works in practice but creates tight coupling and makes the modules difficult to extract independently.

### Function Grouping
- **util.js**: Mixed concerns — formatting, date parsing, generic helpers (chunk, retry)
- **pricing.js**: Single, focused concern — order pricing with weekend logic
- **customers.js**: Customer lookup + slug generation (could be 1 or 2 modules)

The README states "everything in [util.js] is used somewhere," but the module conflates:
- Domain logic (`isWeekend`, `parseDate`)
- Display formatting (`formatMoney`, `describeOrder`)
- Generic utilities (`chunk`, `retry`, `slugify`)

---

## Data & Inputs

### Static Data
**customers.js** has hardcoded customer list:
```javascript
const CUSTOMERS = [
  { id: 'c1', name: 'Ada Fielding' },
  { id: 'c2', name: 'Bo Marsh' },
];
```
- No load mechanism or data source abstraction
- `findCustomer()` falls back to `{ id, name: 'Unknown' }` for missing IDs
- **Concern**: Not reusable across environments; no test data injection point

### Input Validation
**Gaps**:
- `formatMoney(minor)` — assumes `minor` is a number; no check for NaN, negative, or non-integer
- `priceFor(order)` — assumes `order.quantity` and `order.date` exist and are well-formed
- `parseDate(value)` — assumes string format 'YYYY-MM-DD'; fails silently with invalid dates (e.g., `'2026-02-30'` parses to `{ year: 2026, month: 2, day: 30 }` without validation)
- `isWeekend(value)` — depends on `parseDate()` but inherits its lack of validation
- `chunk(rows, size)` — no bounds checking on `size` (e.g., `chunk([], 0)` causes infinite loop)
- `retry(fn, times)` — if `times ≤ 0`, returns immediately; `fn` must throw to trigger retry

No validation at module boundaries; all modules assume callers provide correct types and formats.

---

## Test Coverage

**Current**: Only `src/pricing.js` has test coverage (2 tests in `test/pricing.test.js`).

**Tested**:
- ✓ Weekday order pricing (no surcharge)
- ✓ Weekend order pricing (with 500 surcharge)

**Not Tested**:
- `formatMoney()` — edge cases: negative values, large numbers, rounding
- `describeOrder()` — missing customer fallback, unknown customer IDs
- `slugify()` — empty strings, special characters, unicode
- `parseDate()` — invalid dates, missing parts, non-string input
- `isWeekend()` — leap years, edge dates, invalid dates
- `chunk()` — empty arrays, `size ≤ 0`, size larger than array
- `retry()` — synchronous vs. async, `times ≤ 0`
- `findCustomer()` — missing IDs
- `customerSlug()` — unknown customers

**Critical Gap**: No tests for error conditions or invalid inputs.

---

## Reusability Readiness

### Strengths
1. Single responsibility modules (pricing, customers, util)
2. No external dependencies
3. Pure functions (mostly)
4. Deterministic behavior for valid inputs

### Blockers for Splitting Out

1. **Circular Dependencies**: Extracting `pricing.js` alone requires `util.js` (for `isWeekend`). Extracting `util.js` requires stripping imports from `pricing.js` and `customers.js`. Cannot be split without refactoring.

2. **Hardcoded Static Data**: `CUSTOMERS` list in `customers.js` is baked in. Library consumers cannot provide their own customer data. Requires dependency injection or factory pattern for reuse.

3. **No Input Validation**: Library will throw cryptic errors (or worse, produce wrong results) if given malformed data. Not safe for external use without wrapping or hardening.

4. **Vague Entry Point**: `package.json` points `main` to `src/util.js`, which is a catch-all module. Consumers of only `pricing` functionality must know to import `src/pricing.js` directly. No clear API contract.

5. **Incomplete Test Suite**: Unknown behavior for edge cases and error conditions. Risky for reuse without additional testing.

---

## Behavioral Analysis

### Pricing Logic
- Base price: 2500 minor units (¢) per unit
- Weekend surcharge: +500 minor units (¢)
- No validation that `quantity` is positive
- No handling of fractional quantities

**Example**: `priceFor({ quantity: 2, date: '2026-09-05' })` returns `5500` (weekend, 2x 2500 + 500).

### Date Handling
- Expects 'YYYY-MM-DD' format
- `parseDate()` does not validate day range (e.g., Feb 30 is not caught)
- `isWeekend()` uses `Date.UTC()`, so calculation is correct for valid dates, but garbage-in-garbage-out for invalid dates

**Example**: `isWeekend('2026-09-05')` (Saturday) returns `true`; `isWeekend('2026-09-02')` (Wednesday) returns `false`.

### Customer Fallback
- Known IDs ('c1', 'c2') return hardcoded records
- Unknown IDs return `{ id, name: 'Unknown' }`
- No logging or indication that a fallback occurred

---

## Architecture Recommendations (Not Applied)

**Before Splitting for Reuse**:

1. **Break Circular Dependencies**: Extract `util.js` into two modules:
   - `core-util.js` — generic utilities (`chunk`, `retry`, `slugify`, `formatMoney`)
   - `date-util.js` — date utilities (`parseDate`, `isWeekend`)
   - Have `pricing.js` and `customers.js` depend only on what they need

2. **Add Input Validation**:
   - Validate date strings in `parseDate()`
   - Validate `quantity` is positive in `priceFor()`
   - Guard `chunk()` and `retry()` against edge cases
   - Throw clear errors (e.g., `new Error('Invalid date format: ...')`)

3. **Decouple Customer Data**:
   - Replace hardcoded `CUSTOMERS` list with a dependency-injected data source or factory function
   - Allow consumers to provide their own customer records

4. **Clarify Entry Points**:
   - Define distinct export patterns for each consumer use case
   - Consider separate entry points: `orders-core/pricing`, `orders-core/customers`, `orders-core/util`
   - Add JSDoc or TypeScript types to describe expected inputs

5. **Expand Test Suite**:
   - Add tests for all utilities, especially edge cases and error conditions
   - Test missing customer IDs, invalid dates, and boundary conditions for `chunk()` and `retry()`

---

## Verification Checklist

✓ Code reviewed: all 3 source files + test file  
✓ No external dependencies (pure Node.js)  
✓ Circular imports confirmed (util → pricing/customers, pricing/customers → util)  
✓ Test coverage identified (2 tests; gaps in other modules)  
✓ Input validation gaps documented  
✓ Hardcoded data isolated (CUSTOMERS in customers.js)  
✓ API surface mapped (7 exported functions + secondary exports)  
✓ No intentional side effects observed  

---

## Summary

`orders-core` is a small, focused library with clear core logic but **not currently ready for independent reuse**. Main risks:

1. **Circular module dependencies** prevent extracting individual modules
2. **No input validation** creates silent failures for malformed data
3. **Hardcoded customer list** blocks multi-tenant or dynamic scenarios
4. **Incomplete test coverage** leaves behavior undefined for edge cases

**Recommendation**: Refactor to break circular dependencies, add input validation, and decouple static data before splitting out as a reusable package. The three functions in `pricing.js` are the safest to extract first (with added date validation).
