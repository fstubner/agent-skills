# Orders Core Package Assessment

## Overview
`orders-core` is a small, focused npm package (ESM) providing pricing, customer management, and shared utility functions for an orders system. Entry point: `src/util.js`.

## Architecture

### Module Organization
- **src/util.js** (42 lines): Aggregates shared helpers; currently imports from pricing and customers. Re-exports 6 functions:
  - `formatMoney()` – converts minor units (cents) to displayable currency strings
  - `describeOrder()` – reads customer name and calculates order price
  - `slugify()` – URL-safe string normalization
  - `parseDate()` – splits ISO date string into {year, month, day}
  - `isWeekend()` – determines if a date falls on weekend
  - `chunk()` – arrays-of-arrays batching utility
  - `retry()` – exponential-retry helper (re-throws last error after N attempts)

- **src/pricing.js** (8 lines): Pure pricing logic. Depends on `isWeekend()` from util.
  - `priceFor(order)` – calculates total in minor units: (quantity × 2500 base) + (500 surcharge if weekend)

- **src/customers.js** (15 lines): Static customer database. Depends on `slugify()` from util.
  - `findCustomer(id)` – lookup by ID; returns {id, name: 'Unknown'} for missing IDs
  - `customerSlug(id)` – derives slug from customer name

- **test/pricing.test.js** (12 lines): Two passing test cases for `priceFor()` covering weekday and weekend logic.

## Critical Observations

### Circular Dependency Risk ⚠
- `util.js` imports from both `pricing.js` and `customers.js`
- `pricing.js` imports from `util.js` (isWeekend)
- `customers.js` imports from `util.js` (slugify)

This forms a dependency cycle: util → pricing/customers, and pricing/customers → util. While Node.js ESM can handle this (exports resolve), it creates fragility: refactoring util becomes difficult, and tree-shaking tools may not recognize dead code correctly.

**Recommendation before splitting for reuse:** Break the cycle by moving `isWeekend()` and `slugify()` into separate utility files, or move pricing/customer logic into a dedicated module that doesn't re-export util helpers.

### Input Validation
- `findCustomer()` gracefully handles missing IDs (returns "Unknown")
- `parseDate()` assumes valid ISO date format (YYYY-MM-DD); no validation. Will crash on malformed input (e.g., "not-a-date").
- `priceFor()` assumes `order.quantity` and `order.date` exist and are valid types; no defensive checks.
- `formatMoney()` assumes numeric input; no validation against NaN or Infinity.

### Test Coverage
- Only pricing logic is tested (2 cases: weekday, weekend)
- No tests for util functions (formatMoney, slugify, parseDate, retry, chunk, describeOrder)
- No integration test for `describeOrder()`, which composes multiple functions
- No edge cases tested (e.g., 0 quantity, leap-year dates, unknown customer, retry with all-failing function)

### Documentation
- README is minimal (3 sentences)
- No JSDoc comments or inline function signatures
- No specification of date format expectations (ISO string assumed but not documented)
- No specification of minor-unit convention (cents assumed but not explicit)

### Usability for Reuse
- **Strengths:** Small, readable code; single-responsibility functions (mostly); no external dependencies
- **Weaknesses:** 
  - Circular dependencies make it harder to extract and reuse individual modules
  - Mixing domain logic (pricing, customer) with general-purpose utilities in one package
  - Assumes calling code already knows format/type contracts (dates as YYYY-MM-DD strings, money as integer minor units)

## Data Model Observations
- Customer DB is hardcoded with 2 static entries (Ada, Bo)
- No provision for customer updates, adds, or persistence
- Order object structure inferred from usage (minimally: {customerId, quantity, date})
- Date format is ISO string; month is 1-indexed (matches typical human input, differs from JavaScript Date)

## Readiness for Reuse

| Aspect | Status | Note |
|--------|--------|------|
| Code runs | ✓ Tests pass | Pricing logic verified correct |
| No external deps | ✓ | Only Node.js builtins |
| Clear boundaries | ✗ | Circular dependencies; util mixes concerns |
| Input validation | ✗ | No defensive checks at entry points |
| Documented contracts | ✗ | Implicit assumptions (date format, money units, object shapes) |
| Test coverage | ✗ | Only 2 tests; no util or integration coverage |
| Backwards compat | N/A | First reuse; consider additive exports only for future versions |

## Recommendations Before Splitting for Reuse

1. **Resolve circular dependency:** Separate general utils (formatMoney, slugify, parseDate, retry, chunk) into a self-contained `util.js` that has no dependencies on domain modules.

2. **Harden inputs:** Add validation at public entry points (priceFor, findCustomer, parseDate) or document format/type assumptions explicitly.

3. **Expand tests:** Add tests for all exported functions, including edge cases (invalid dates, missing objects, retry exhaustion). Test integration (describeOrder with real and missing customers).

4. **Document contracts:** Add JSDoc or README section specifying:
   - Date format (YYYY-MM-DD)
   - Money units (cents/minor, not dollars)
   - Order object shape
   - Customer DB scope (static; no mutation)

5. **Clarify package scope:** Decide if this is a reusable "core utilities" package or a "domain logic" package. Current mix makes both hard. Consider:
   - Split into `orders-utils` (pure functions) and `orders-domain` (pricing, customers), OR
   - Rename to emphasize domain (e.g., `orders-pricing`) and scope narrowly

## Verification Performed
- Inspected all 6 files (package.json, README, 3 source modules, 1 test suite)
- Analyzed code logic, dependencies, and test coverage
- Confirmed package is Node.js ESM with no npm dependencies
- Verified test suite structure and date logic correctness
