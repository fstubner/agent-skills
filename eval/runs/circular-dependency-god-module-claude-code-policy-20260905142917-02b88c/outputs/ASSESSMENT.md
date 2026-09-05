# Package Assessment: orders-core

## Summary
This is a pricing and customer lookup package with shared utilities. It is mostly functional but has architectural and quality concerns that should be addressed before reuse.

**Status**: Not ready for reuse without fixes.

---

## Verified Functionality
- ✓ Tests pass (2/2 pricing tests)
- ✓ Core pricing logic works with weekend surcharge
- ✓ Customer lookup returns sensible defaults
- ✓ Utility functions execute without runtime errors

---

## Critical Issues

### 1. Circular Module Dependency
**Location**: `pricing.js` → `util.js` → (indirectly back via `describeOrder`)

- `pricing.js` imports `isWeekend` from `util.js`
- `util.js` imports `priceFor` from `pricing.js` (used in `describeOrder`)
- This creates a circular dependency that can cause issues in bundlers, treeshaking, and dynamic imports
- **Impact**: Fragile when the package is split or consumed by different build systems

**Fix needed**: Move `describeOrder` to a separate module or restructure imports to break the cycle.

---

## Input Validation Gaps

### Missing validation at trust boundaries:
1. **`parseDate(value)`** (util.js:18-20)
   - No validation of format (accepts any string)
   - Accepts invalid dates (e.g., "2026-13-01" parses without error)
   - `isWeekend` will silently produce wrong results for invalid input

2. **`isWeekend(value)`** (util.js:23-26)
   - No guard against non-string or malformed input
   - No error handling if Date construction fails

3. **`priceFor(order)`** (pricing.js:5-7)
   - Assumes `order.date` and `order.quantity` exist
   - No validation of `quantity` (negative/non-numeric values not caught)
   - Silent failure if properties missing

4. **`findCustomer(id)`** (customers.js:8-9)
   - Returns `Unknown` for unmapped IDs, which may hide data errors
   - No warning when fallback is used

**Fix needed**: Add validation and error handling at the public API boundary (exports).

---

## Test Coverage
- Only 2 tests, covering only `priceFor()`
- **Not tested**: `findCustomer()`, `customerSlug()`, `slugify()`, `parseDate()`, `formatMoney()`, `chunk()`, `retry()`
- Incomplete coverage for critical functions like date parsing and customer lookup

**Fix needed**: Add tests for `customers.js` and `util.js` functions, especially error cases.

---

## Design Concerns

### 1. Cohesion of `util.js`
This module mixes unrelated concerns:
- Money formatting (`formatMoney`)
- Order summarization (`describeOrder`)
- Text transformation (`slugify`)
- Date parsing (`parseDate`, `isWeekend`)
- Generic utilities (`chunk`, `retry`)

**Question**: Do `chunk()` and `retry()` belong in an orders-specific package? They are generic but may indicate feature creep.

### 2. Hard-coded Customer Data
`customers.js` has a static CUSTOMERS array. This severely limits reusability:
- Cannot add/update customers
- No integration with external data sources
- Not suitable for production use

**Fix needed**: Make customer lookup pluggable or data-driven.

### 3. Incomplete Package Metadata
`package.json` specifies `"main": "src/util.js"` but:
- `util.js` is not the public API
- No named exports to clarify the module boundaries
- No version field
- Exports should be explicit

**Fix needed**: Set proper main entry point or use `"exports"` field for clarity.

---

## Documentation Issues
- No JSDoc comments on functions
- No type hints (neither JSDoc nor TypeScript)
- "minor" units (cents) convention not documented
- No README explaining module responsibilities

**Fix needed**: Add function documentation before splitting.

---

## Data Integrity Issues

### `retry()` function (util.js:35-41)
```javascript
export function retry(fn, times) {
  let last;
  for (let i = 0; i < times; i += 1) {
    try { return fn(); } catch (error) { last = error; }
  }
  throw last;
}
```
- Swallows all errors except the last, which can hide transient failures
- If `times` is 0, throws `undefined`
- No logging of intermediate failures

---

## Recommendations (Priority Order)

1. **CRITICAL**: Resolve circular dependency between `pricing.js` and `util.js`
2. **CRITICAL**: Add input validation to `parseDate()`, `priceFor()`, `isWeekend()`
3. **HIGH**: Extend tests to cover customers and utilities
4. **HIGH**: Clarify package exports and set proper main entry point
5. **HIGH**: Decide if `chunk()` and `retry()` belong in this package
6. **MEDIUM**: Add JSDoc documentation
7. **MEDIUM**: Make customer data source pluggable
8. **LOW**: Improve error messages in `retry()`

---

## Uncertainty
- No information about how this package will be consumed (bundler, Node versions, deployment environment)
- No specification of which functions constitute the public API
- Unclear if generic utilities (`chunk`, `retry`) are truly needed or are legacy code

---

## Conclusion
The core pricing logic is sound and tested. However, the package has modularity issues (circular dependencies), insufficient input validation for a public library, and incomplete test coverage. These should be resolved before splitting out for reuse.
