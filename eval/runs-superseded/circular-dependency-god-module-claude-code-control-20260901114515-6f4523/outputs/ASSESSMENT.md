# Assessment: orders-core Package for Reuse

## Overview
`orders-core` is a small package providing order pricing, customer lookup, and shared utility functions. While functional, it has significant structural issues that will impact reusability.

## Critical Issues

### 1. Circular Dependencies
**Severity: HIGH**

The package has circular module dependencies that will block extraction and reuse:
- `util.js` → `pricing.js` → `util.js` (via `isWeekend`)
- `util.js` → `customers.js` → `util.js` (via `slugify`)

**Impact:** Consumers cannot selectively import individual modules. The entire package must be imported as a unit, severely limiting reusability.

### 2. Mixed Responsibilities in util.js
**Severity: HIGH**

`util.js` is a catch-all module containing:
- **Domain-specific functions**: `priceFor`, `findCustomer`, `describeOrder` (couples pricing + customers + formatting)
- **Data utilities**: `slugify`, `parseDate`, `formatMoney`
- **Generic utilities**: `chunk`, `retry`

**Impact:** No clear separation of concerns. Functions have different levels of specificity and reusability, making it hard to identify what should be extracted as standalone utilities vs. business logic.

### 3. Unclear API Boundaries
**Severity: MEDIUM**

The package.json declares `main: "src/util.js"`, suggesting util.js is the public API. However:
- The README mentions pricing, customers, and shared helpers as separate concepts
- No clear documentation of what constitutes the public API
- No index file aggregating exports

**Impact:** Consumers lack clarity on what to depend on and how modules relate to each other.

## Structural Problems

### Function Coupling
- `describeOrder()` directly depends on both `priceFor()` and `findCustomer()`, creating a tight integration point
- This function is more of an application concern than a reusable component

### Missing Abstractions
- `parseDate()` and `isWeekend()` are tightly bound; could benefit from a Date abstraction
- `formatMoney()` and price-related logic are scattered

### Incomplete Test Coverage
- Only `priceFor()` is tested
- No tests for utility functions (`parseDate`, `slugify`, `chunk`, `retry`)
- No tests for `customers.js` or cross-module integration
- Missing edge cases and error scenarios

## Reusability Assessment

### Feasible to Reuse:
- ✓ Generic utilities (`chunk`, `retry`, `formatMoney`, `slugify`) could be useful standalone
- ✓ Pricing logic (`priceFor`) is cleanly separated in its own module
- ✓ Customer lookup logic is straightforward

### Difficult to Reuse:
- ✗ Cannot extract individual modules without resolving circular dependencies
- ✗ Cannot import just pricing or customers without pulling in unrelated utilities
- ✗ `describeOrder` couples multiple concerns and is not reusable in its current form
- ✗ Lack of error handling and validation limits applicability to new contexts

## Recommendations Before Extraction

1. **Break circular dependencies** - Reorganize so specific utilities don't depend on domain-specific modules
2. **Create clear boundaries** - Separate generic utilities from domain logic into different files/exports
3. **Define public API** - Create an index file with explicit exports and document the module contract
4. **Expand test coverage** - Add tests for all utility functions and cross-module interactions
5. **Consider composite functions** - Move functions like `describeOrder` to application layer rather than core
6. **Add validation** - Especially for `parseDate`, `slugify`, and price calculations with edge cases

## Current State Summary
The package is functional for its current use case but not ready for reuse as a standalone component. The circular dependencies and mixed responsibilities will cause problems when splitting out for reuse. Consumers will be forced to adopt the entire package with all its coupling, reducing modularity and creating maintenance burden.
