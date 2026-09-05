# Package Assessment: orders-core

## Overview
`orders-core` is an ES module package containing order pricing, customer management, and shared utilities. The main entry point is `src/util.js`, and it exports 7 functions across three source files.

## Code Structure

### Modules
- **pricing.js** (1 export): `priceFor()` - calculates order cost with optional weekend surcharge
- **customers.js** (2 exports): `findCustomer()`, `customerSlug()` - customer lookup and slug generation
- **util.js** (7 exports): Mixed utilities including `formatMoney()`, `describeOrder()`, `isWeekend()`, `parseDate()`, `slugify()`, `chunk()`, `retry()`

## Critical Issues for Reusability

### 1. Circular Dependencies (High Priority)
The package has circular imports that would prevent extraction:
- `util.js` imports `priceFor` from `pricing.js`
- `pricing.js` imports `isWeekend` from `util.js`
- `util.js` imports `findCustomer` from `customers.js`
- `customers.js` imports `slugify` from `util.js`

This circular dependency structure creates tight coupling and would fail if the package were split into separate modules.

### 2. Mixed Concerns in util.js
The utility module contains functions of different scopes:
- **Domain-specific**: `formatMoney()`, `describeOrder()`, `isWeekend()` (tightly coupled to orders and pricing)
- **Generic helpers**: `slugify()`, `chunk()`, `retry()`, `parseDate()` (general-purpose utilities)

These should be separated when extracting for reuse.

## Code Quality Assessment

### Strengths
- **Correct implementations**: Pricing logic, date parsing, and utility functions work as intended
- **ISO 8601 date handling**: Uses UTC dates consistently (good for distributed systems)
- **Concise code**: Functions are readable and well-scoped
- **Sensible defaults**: Customer lookup gracefully falls back to "Unknown" for missing IDs
- **Appropriate use of modern JS**: Arrow functions, destructuring, spread operators used properly

### Testing Coverage
- ✓ Pricing module has 2 test cases (weekday/weekend surcharge)
- ✗ Customers module has no tests
- ✗ Utility functions have no tests
- **Gap**: No tests for edge cases in date parsing or utility functions

### No Security Issues Identified
- No arbitrary code execution risks
- Date handling is safe (UTC normalization prevents timezone confusion)
- String manipulation is safe (slugify uses whitelist approach with character ranges)

## Readiness for Extraction

**Current Status**: Not ready for reuse without refactoring

**Blockers**:
1. Circular dependencies must be resolved (separate domain-specific from generic utilities)
2. Test coverage is incomplete (only pricing tested)
3. util.js needs to be split into domain-specific and generic layers

**Recommended Actions Before Split**:
1. Break circular dependencies by extracting generic utilities to a separate package
2. Move domain-specific functions (`formatMoney`, `describeOrder`, `isWeekend`) to a dedicated orders layer
3. Add test coverage for `customers.js` and remaining utility functions
4. Update module entry points to reflect new structure

## Verification Summary

✓ No code changes made  
✓ Circular dependencies identified  
✓ Code quality assessed  
✓ Test coverage gaps documented  
✓ Architecture issues blocking reuse documented  
