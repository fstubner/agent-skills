# Package Assessment: orders-core

## Overview
`orders-core` is a Node.js package providing pricing calculations, customer management, and shared utilities for an orders system. The package is structured as an ES module with three main source files and basic test coverage.

## Strengths

### Code Quality
- **Clarity**: Code is concise, readable, and follows consistent naming conventions
- **Function Design**: Functions are small and focused on single responsibilities
- **No External Dependencies**: Package has no npm dependencies, reducing supply chain risk
- **Modern Tooling**: Uses ES modules and Node's built-in `test` runner
- **Correctness**: All existing tests pass

### Functionality
- **Pricing Logic**: Correctly handles base pricing and weekend surcharges
- **Date Handling**: Proper UTC-based weekend detection accounts for timezone edge cases
- **Utility Suite**: Includes commonly needed helpers (formatting, string manipulation, retry logic, chunking)
- **Clean Exports**: Each module has a clear public API

## Critical Issues Preventing Reuse

### 1. Circular Dependencies
The package has a problematic circular dependency structure:
- `util.js` (entry point) imports from `pricing.js` and `customers.js`
- `pricing.js` imports from `util.js`
- `customers.js` imports from `util.js`

**Impact**: When splitting out `util.js` for reuse, the domain-specific functions (`priceFor`, `findCustomer`) cannot be cleanly separated. The utilities have hard dependencies on domain logic.

**Example**: `describeOrder()` in `util.js` directly calls `findCustomer()` and `priceFor()`, mixing domain concerns with general-purpose utilities.

### 2. Conflicting Module Purpose
- `package.json` declares `util.js` as the main entry point
- However, `util.js` imports and depends on domain-specific modules (`pricing.js`, `customers.js`)
- A reusable utility module should not import domain logic

**Impact**: Consumers of `util.js` would be forced to bundle unused pricing and customer logic.

### 3. Test Coverage Gaps
- Only 2 tests, both for `pricing.priceFor()`
- No tests for `customers.js` functions
- No tests for utility functions: `formatMoney`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`
- `describeOrder()` is untested

**Impact**: Confidence in correctness is limited; refactoring for reuse carries higher risk.

## Moderate Issues

### 1. Hard-coded Data
- `customers.js` contains hard-coded CUSTOMERS array
- Only 2 customers defined; unclear if this is a fixture or production data
- No mechanism to extend or mock customer data

**Impact**: Package cannot be used in different contexts without modifying source code.

### 2. Inconsistent Abstraction Levels
- `util.js` mixes general utilities (string formatting, array chunking) with domain orchestration (`describeOrder`)
- No clear separation of concerns

### 3. Missing Documentation
- No JSDoc comments explaining parameter types or return values
- No inline comments explaining non-obvious logic (e.g., why weekend detection uses UTC)
- README acknowledges `util.js` has "grown a bit" but provides no guidance on what should/shouldn't be there

## Recommendations for Reuse

Before extracting this package for reuse:

1. **Resolve circular dependencies**: Move domain-specific utilities into separate modules or consolidate into domain modules
2. **Clarify entry point**: Decide whether this is a utility library or a domain library; adjust `main` in `package.json` accordingly
3. **Expand test coverage**: Add tests for all exported functions, especially utilities
4. **Extract pure utilities**: If reusing utilities, separate them from domain logic; consider splitting into separate packages (e.g., `@orders/utils` vs `@orders/pricing`)
5. **Document hard constraints**: Clarify customer data handling and weekend calculation assumptions
6. **Consider scope**: Determine if retry logic, chunking, and money formatting belong in an orders-specific package or should move to shared infrastructure

## Verified
- ✓ Package structure and dependencies reviewed
- ✓ All source files readable and syntax valid
- ✓ Tests pass (2/2)
- ✓ No external npm dependencies
- ✓ ES module syntax consistent
