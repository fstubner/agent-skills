# Assessment: orders-core Package

## Overview
`orders-core` is a small utility library (6 source files) providing pricing, customer management, and shared helpers for an orders domain. The package is ready to split for reuse with some caveats.

## Strengths

**Focused scope**: Three core modules with clear responsibilities—pricing logic, customer data, and utility functions.

**Minimal dependencies**: No external npm dependencies; all code is internal.

**Established usage patterns**: The modules are already imported across the codebase (pricing used by util, customers used by util, etc.), showing real integration.

**Test foundation**: Basic test suite exists for pricing logic (weekday/weekend surcharge cases).

**Clean API surface**: Public functions are straightforward (priceFor, findCustomer, formatMoney, etc.).

## Concerns for Reuse

### Architecture & Coupling
- **Circular-like dependencies**: `util.js` imports from `pricing.js` and `customers.js`, while both of those import from `util.js`. This creates a tight coupling that makes `util.js` a potential bottleneck during maintenance.
- **Responsibility boundary**: `util.js` mixes domain-specific functions (formatMoney, describeOrder) with generic utilities (chunk, retry, slugify). Splitting these concerns would reduce coupling and make the package easier to understand.

### Validation & Error Handling
- **No input validation**: Functions like `priceFor`, `findCustomer`, and `parseDate` do not validate their inputs. Missing or malformed data will fail silently or with unclear errors.
- **No error handling**: `parseDate` assumes well-formed "YYYY-MM-DD" input. Invalid strings will produce NaN or incorrect results without throwing.
- **Hardcoded data**: Customer list is hardcoded in `customers.js` and returns a fallback "Unknown" customer. No way to add/update customers or validate IDs.

### Test Coverage
- **Incomplete**: Only `pricing.js` has tests. The critical functions in `util.js` (formatMoney, slugify, parseDate, isWeekend, etc.) and `customers.js` are untested.
- **Date parsing**: The `parseDate` and `isWeekend` logic is complex (ISO-like parsing + UTC weekday calculation) but lacks edge-case tests (leap years, month boundaries, invalid dates).

### Maintainability
- **Date handling**: Custom date parsing via string split/map is brittle. Using standard Date objects would be more robust and self-documenting.
- **Generic helpers**: `chunk` and `retry` are domain-agnostic and may not belong in an orders-specific package. Consider moving to a shared utilities library if used elsewhere.
- **API brittleness**: The `describeOrder` function in `util.js` couples order formatting to pricing calculation—if pricing rules change, the description may unexpectedly change.

### Documentation
- **Minimal README**: Doesn't describe the intended use, exports, or dependencies. No API docs for individual functions.
- **No comments**: While the code is readable, the business rules (BASE_MINOR pricing, surcharge logic, weekend definition) lack context.

## Material Unknowns

1. **Deployment context**: Is this package used by a single consumer or multiple services? Circular dependencies are manageable in monoliths but problematic for independently deployed packages.
2. **Customer data source**: Should the customer list be dynamic (loaded from a database or config) rather than hardcoded?
3. **Pricing extensibility**: Will surcharge rules change? Are other order types or pricing models needed?
4. **Reuse scope**: Which functions are essential for reuse vs. internal? Should `chunk` and `retry` be separate?

## Recommendations

**Before splitting for reuse:**
1. Break the circular dependency by moving generic utilities (`chunk`, `retry`) or domain helpers (`formatMoney`, `slugify`) to separate modules.
2. Add input validation and error handling, especially for `parseDate` and customer lookups.
3. Expand test coverage to `util.js` and `customers.js`.
4. Clarify the API surface with a brief README documenting exports and examples.

**Post-split considerations:**
- Extract `chunk` and `retry` to a generic utility library if they're used outside this domain.
- Consider making customer data injectable (passed in rather than hardcoded) for flexibility.
- Use standard Date objects instead of custom parsing if timezone handling is needed.

## Verdict

The package is **suitable for split and reuse with moderate risk**. The core logic is sound and already integrated internally. However, the tight coupling, missing validation, and incomplete test coverage mean consumers will need defensive integration. Addressing the circular dependency and adding validation before split would significantly reduce risk.
