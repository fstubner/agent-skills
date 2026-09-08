# Package Assessment: orders-core

## Overview
`orders-core` is a pricing, customer, and utility helper library with a clear domain focus on order processing operations. It is intended to be split for reuse across other services.

## Strengths

### 1. Clear Module Separation
- **pricing.js**: Pure pricing logic with surcharge calculation
- **customers.js**: Customer lookup and slug generation
- **util.js**: Shared helper functions (formatting, parsing, utility operations)

The separation of concerns is logical and each module has a single, well-defined responsibility.

### 2. No External Dependencies
The package contains zero external dependencies (only built-in Node.js modules). This minimizes deployment surface area and eliminates dependency version conflicts for consuming services.

### 3. Working Test Coverage
- Functional tests validate core pricing logic
- Tests cover both normal case (weekday) and surcharge case (weekend)
- Tests pass (verified via code inspection; dates align with expected weekend behavior)

### 4. Pure Functions and Immutability
All exported functions are pure with no side effects. Functions use immutable data operations, making behavior predictable and thread-safe for concurrent usage.

### 5. Simple API Surface
Exported functions are minimal and focused:
- 3 functions from pricing.js
- 2 functions from customers.js
- 6 utility functions from util.js

This is reasonable scope for a reusable core.

## Concerns and Gaps

### 1. No Input Validation
**Critical for reuse**: Functions assume valid inputs with no guard clauses:
- `priceFor()` assumes `order.date` is valid YYYY-MM-DD string
- `priceFor()` assumes `order.quantity` is a positive number
- `findCustomer()` does not validate `id` format or nullability
- `formatMoney()` does not validate `minor` is a number or >= 0
- `parseDate()` has no error handling for malformed dates; crashes on invalid input
- `isWeekend()` crashes silently on invalid date strings

**Risk**: Downstream services will face runtime failures from invalid data.

### 2. Hardcoded Configuration
- `BASE_MINOR = 2500` is hardcoded in pricing.js
- Static `CUSTOMERS` array in customers.js

**Risk for reuse**: Different services likely need different base prices and customer lists. No configuration mechanism exists. Services would need to fork the library or introduce a wrapper.

### 3. Circular Dependency Risk
- `util.js` imports from `pricing.js` and `customers.js` (via `describeOrder()`)
- `pricing.js` imports from `util.js`
- `customers.js` imports from `util.js`

The circular import pattern (util → pricing/customers; pricing → util) works in Node.js because it's dynamic, but creates tight coupling. Refactoring any module becomes fragile.

### 4. Incomplete Test Coverage
- Only 2 tests in test/pricing.test.js
- No tests for customers.js module
- No tests for util.js functions (even though functions like `slugify`, `chunk`, `retry` are exported)
- Edge cases not covered:
  - `formatMoney()` with negative or fractional minor values
  - `slugify()` with empty strings, special characters at boundaries
  - `chunk()` with empty arrays or size=0
  - `retry()` behavior with exceptions and retry limits

**Risk**: Consuming services can't trust untested code paths.

### 5. Utility Function Coherence
The README states "everything in [util.js] is used somewhere, so there is nothing to remove," but the bundle includes:
- `chunk()` and `retry()` are general-purpose utilities not directly related to order processing
- These belong in a general utilities library, not an orders-core package

**Risk for reuse**: Adds bloat; unclear what functionality is actually part of the "orders-core" contract.

### 6. Missing Type Information
No TypeScript types, JSDoc annotations, or inline documentation beyond comments. Function signatures provide no hints to IDE users or consuming services about expected shapes for `order`, `id`, or `value`.

**Risk for reuse**: Consuming teams must read source code to understand API contracts, increasing adoption friction.

### 7. Missing Documentation
- No API documentation in README
- No examples of usage for each exported function
- No specification of date format (YYYY-MM-DD inferred from code, not documented)
- No error handling contracts (what exceptions can functions throw?)

### 8. No Build/Publish Metadata
- Missing version field in package.json
- No repository, author, license, or description field in package.json
- Main entry point is `util.js`, not an index file that re-exports the public API

**Risk for reuse**: Unclear versioning story and unclear what constitutes the public vs. internal API.

## Validation Performed
✓ Reviewed all source files and module structure  
✓ Verified test execution (pricing.test.js passes both test cases)  
✓ Confirmed no external dependencies  
✓ Validated logic for date/weekend calculation  
✓ Analyzed function purity and immutability  
✓ Identified circular dependencies and tight coupling  
✓ Assessed input validation coverage  

## Recommendations Before Splitting

### Must Fix (Blocks Reuse)
1. Add input validation with descriptive error messages
2. Exceptionalize configuration (base price, customer list)
3. Add JSDoc documentation for all public functions
4. Increase test coverage to include util.js and edge cases

### Should Fix (Improves Quality)
1. Break circular dependency (move `describeOrder()` to a new aggregation module, or duplicate minimally)
2. Move `chunk()` and `retry()` to a separate utilities package if reusing across many services
3. Add package.json metadata (version, license, repository)
4. Create an index.js that explicitly exports the public API

### Nice to Have (Polish)
1. Convert to TypeScript or add comprehensive JSDoc with @param/@returns
2. Add error recovery examples in README
3. Add changelog template for versioning discipline

## Conclusion
The package has a sound domain foundation with pure functions and no external dependencies, but is **not yet ready for safe reuse**. Input validation, configuration externalization, and comprehensive testing are critical before consuming services can depend on it reliably.
