# Assessment: orders-core Package

## Overview
The `orders-core` package contains pricing calculation, customer lookup, and shared utility functions for an orders management system. It consists of three modules with no external dependencies.

## Strengths

1. **Clean, focused code**: The source files are well-written with clear function names and minimal logic per function.

2. **No external dependencies**: Pure JavaScript with only Node.js built-ins, making it lightweight and easy to integrate.

3. **Simple, stable APIs**: Core functions (`priceFor`, `findCustomer`, `formatMoney`, etc.) are straightforward to understand and use.

4. **Domain-specific logic is isolated**: `pricing.js` and `customers.js` each have a clear, single responsibility.

5. **Good test coverage for core feature**: The pricing calculation is tested with multiple scenarios (weekday/weekend surcharges).

## Issues for Reuse

### 1. **Circular Dependency**
- **Location**: `util.js` imports from `pricing.js` and `customers.js`, while those modules import back from `util.js`
- **Impact**: Creates tight coupling and makes modules harder to extract or test independently
- **Example**: `util.js` → `priceFor` (in `pricing.js`), but `pricing.js` → `isWeekend` (in `util.js`)

### 2. **Mixed Concerns in util.js**
- **Issue**: The module combines unrelated utilities: money formatting, date parsing, string manipulation, order description, and generic helpers (chunk, retry)
- **Impact**: When reusing one utility (e.g., `slugify`), you're importing a module with unrelated functionality
- **Current utilities**: formatMoney, describeOrder, slugify, parseDate, isWeekend, chunk, retry (7 functions with 4+ distinct purposes)

### 3. **Hard-coded Data in customers.js**
- **Issue**: Customer data is embedded as a static array with only two entries
- **Impact**: Severely limits reusability; any external use would need its own customer source or require modifying this module
- **Path forward**: Requires dependency injection or abstraction of the data layer

### 4. **Incomplete Test Coverage**
- **Coverage**: Only `pricing.js` has tests (2 test cases)
- **Missing**: No tests for `customers.js`, `util.js` functions, or integration scenarios
- **Risk**: Changes to util.js or customers.js lack safety net

### 5. **Missing Documentation**
- **Issue**: No JSDoc comments on any functions
- **Impact**: Developers must read implementation to understand behavior, edge cases, and parameter types
- **Examples**: `parseDate` format requirements, `chunk` behavior with non-divisible sizes, `retry` error handling

### 6. **Limited Date Parsing**
- **Issue**: `parseDate` expects only `YYYY-MM-DD` format; no validation or error handling for invalid formats
- **Risk**: Silent failures or unexpected behavior with malformed date strings

## Readiness for Splitting/Reuse

| Module | Readiness | Notes |
|--------|-----------|-------|
| **pricing.js** | Good | Domain-specific, tested, minimal dependencies. Remove `describeOrder` from util usage for cleaner separation. |
| **customers.js** | Fair | Needs data source abstraction before external reuse. Current hard-coded data is package-specific. |
| **util.js** | Poor | Too many unrelated utilities; circular dependencies. Should be split by concern (formatting, date handling, generic helpers). |

## Recommendations Before Splitting

1. **Resolve circular dependency**: Move shared functions used by pricing/customers to a separate `_internal.js` or inline them
2. **Document functions**: Add JSDoc comments with parameter types and examples
3. **Add comprehensive tests**: Test all util functions, customers module, and integration scenarios
4. **Separate util.js**: Split into focused modules like `date.js`, `format.js`, `generic.js`
5. **Abstract customer data**: Replace hard-coded CUSTOMERS with a configurable lookup function or abstract interface
6. **Add input validation**: Validate date format, handle edge cases

## Summary

The package has clean, readable code with clear domain logic, but significant structural issues that limit reusability. The circular dependency, mixed concerns in util.js, and hard-coded data are the primary blockers. It's suitable for use as-is within a single system but would require refactoring—particularly around dependencies and test coverage—before safely extracting for reuse across multiple projects.
