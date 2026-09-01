# Package Assessment: orders-core

## Overview
The `orders-core` package provides order-related functionality including pricing calculations, customer management, and shared utilities. It consists of three ES modules: `pricing.js`, `customers.js`, and `util.js`.

## Strengths

- **Clear modular structure**: Three focused modules with distinct responsibilities (pricing, customers, utilities)
- **Simple, focused APIs**: Export functions have clear signatures and single purposes
- **Working implementation**: Core pricing and customer lookups function correctly
- **Test coverage exists**: Pricing module has test cases demonstrating correct behavior
- **Minimal dependencies**: No external npm dependencies; only uses Node.js built-ins

## Concerns for Reuse

### 1. Circular Dependencies
- `util.js` imports from both `pricing.js` and `customers.js`
- Both `pricing.js` and `customers.js` import from `util.js`
- This circular pattern works but creates tighter coupling than necessary and complicates dependency graphs

### 2. Hardcoded Configuration
- **Customer data**: `customers.js` contains a hardcoded array of two customers. No way to load external data or support dynamic customer registration
- **Pricing constants**: `BASE_MINOR` (2500) and weekend surcharge (500) are hardcoded in `pricing.js`. Not parameterizable
- These make the package rigid and unsuitable for different pricing models or customer sources

### 3. Mixed Concerns in util.js
The utilities module conflates two categories:
- **Order-specific**: `formatMoney()`, `describeOrder()` - tightly coupled to order domain
- **Generic**: `slugify()`, `chunk()`, `retry()`, `parseDate()`, `isWeekend()` - could be used anywhere

This mixing makes it difficult to reuse just the generic utilities without pulling in order logic.

### 4. Implicit Contract Assumptions
- Order objects must have `.customerId`, `.quantity`, and `.date` properties
- Date strings must be in `YYYY-MM-DD` format
- No validation or error handling for malformed inputs
- These assumptions are undocumented, making misuse likely

### 5. Limited Test Coverage
- Only `pricing.js` has tests (2 test cases)
- No tests for `customers.js` or `util.js` functions
- Unclear which utilities are actively used or stable
- README notes "everything in [util.js] is used somewhere" but doesn't document where

### 6. Error Handling and Edge Cases
- `findCustomer()` silently returns "Unknown" for missing customers—masks data problems
- `priceFor()` performs no validation of order.quantity (accepts 0, negative, non-integer)
- `parseDate()` doesn't handle invalid date strings; produces incorrect results silently
- `retry()` will throw if all attempts fail, but error message is generic

### 7. No Type Information
- Written in plain JavaScript with no TypeScript or JSDoc annotations
- No type hints for function parameters or return values
- Increases risk of misuse when reused in larger codebases

### 8. Naming Ambiguities
- `describeOrder()` in util.js assumes knowledge of order structure and couples that utility to the domain
- `priceFor()` doesn't indicate why weekend dates trigger a surcharge or what the base price unit is

## Reusability Limitations

| Module | Suitable for Reuse? | Issues |
|--------|---|---|
| **pricing.js** | Limited | Hard-coded rates; no configuration mechanism; tightly coupled to util.js via isWeekend |
| **customers.js** | No | Hardcoded customer list; no way to swap data source |
| **util.js** | Partial | Generic utilities are reusable but tangled with order-specific code |

## Recommendations for Reuse

To make this package suitable for splitting out and reusing:

1. **Break circular dependencies**: Restructure so that `pricing.js` and `customers.js` don't import from `util.js`, or move util functions closer to their usage
2. **Extract generic utilities**: Separate `chunk()`, `retry()`, `parseDate()` into a standalone utility library
3. **Externalize configuration**: Move pricing constants and customer data to configuration, injection, or external sources
4. **Add type annotations**: Use JSDoc or TypeScript to document expected types and contracts
5. **Expand test coverage**: Add tests for all modules, especially edge cases and error conditions
6. **Add validation**: Validate order objects and dates at boundaries; fail fast on invalid input
7. **Document assumptions**: Add comments explaining order object shape, date format expectations, and pricing logic
8. **Rethink customer fallback**: Consider throwing an error for missing customers rather than returning "Unknown"

## Conclusion

The package works for its current narrow use case but needs refactoring before reuse. The circular dependencies, hardcoded configuration, mixed concerns, and lack of validation and testing make it risky to extract as a standalone reusable library. Focusing on breaking the circular dependency structure and externalizing configuration would be the highest-impact changes.

