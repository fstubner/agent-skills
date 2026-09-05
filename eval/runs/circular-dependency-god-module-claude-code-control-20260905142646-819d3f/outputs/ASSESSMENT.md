# Package Assessment: orders-core

## Overview
The `orders-core` package combines pricing calculations, customer data, and shared utility functions. The entry point is `src/util.js`, though the package spans three modules with complex interdependencies.

## Structural Issues

### 1. Circular Dependencies
**Severity: High**

The package has problematic circular imports:
- `util.js` imports from both `pricing.js` and `customers.js`
- Both `pricing.js` and `customers.js` import from `util.js`

This creates a circular dependency chain that will complicate:
- Tree-shaking and bundling
- Module reuse in different contexts
- Testing isolation
- Future refactoring

### 2. Incoherent Module Design
**Severity: Medium**

`util.js` conflates multiple concerns:
- **Date/time utilities**: `parseDate`, `isWeekend` (domain-specific)
- **Formatting**: `formatMoney` (domain-specific)
- **Business logic**: `describeOrder` (combines pricing + customer lookup)
- **Text manipulation**: `slugify` (generic)
- **Array operations**: `chunk` (generic)
- **Retry logic**: `retry` (generic, infrastructure-level)

These utilities span multiple abstraction levels and domains. Generic utilities (chunk, retry, slugify) share a module with domain-specific logic.

### 3. Unclear API Surface
**Severity: Medium**

- Main entry point is `util.js`, but package name suggests pricing/customer focus
- No clear indication of what's public API vs. internal helper
- No distinction between domain utilities and generic utilities

## Unused Exports

**Severity: Low**

The README claims "everything in it is used somewhere," but the following exports are not referenced outside their modules:
- `util.describeOrder` — only uses internal functions
- `util.chunk` — never imported
- `util.retry` — never imported
- `customers.customerSlug` — never imported
- `util.formatMoney` — only used by `describeOrder`

Additionally, `util.parseDate` is only used internally by `util.isWeekend`.

## Positive Aspects

### Strong Points
- **Clear, focused business logic**: `pricing.js` has a single, well-defined responsibility
- **Simple data model**: Customer lookup is straightforward
- **Test coverage**: Pricing logic has tests covering weekday/weekend cases
- **No external dependencies**: Pure JavaScript with only Node.js built-ins
- **ES modules**: Modern module format with clean imports

### Functional Correctness
- Logic appears sound (pricing calculation, date checking, customer lookup)
- Test cases validate weekend surcharge behavior
- Date parsing and weekend detection appear correct

## Reusability Assessment

### Challenges for Reuse
1. **Cannot cleanly extract pricing** — requires `isWeekend` from util, which creates circular import
2. **Cannot cleanly extract customers** — requires `slugify` from util, which imports from pricing
3. **Cannot cleanly extract util** — depends on both pricing and customers

### Recommendation for Splitting
To make this package reusable, restructure to break circular dependencies:

**Option A: Dependency Inversion**
- Create `core-date.js` with `parseDate`, `isWeekend` (no dependencies)
- Create `core-text.js` with `slugify` (no dependencies)
- Create `core-format.js` with `formatMoney` (no dependencies)
- Update `pricing.js` to import from `core-date.js`
- Update `customers.js` to import from `core-text.js`
- Make `util.js` import from these specialized modules (one-way dependency)

**Option B: Extract Micro-packages**
- `pricing-core` (pricing.js + isWeekend dependency)
- `customer-core` (customers.js + slugify dependency)
- `util-core` (standalone utilities)

This would allow selective imports and reduce coupling.

## Summary

**Current State**: The package is functional for its current use case but exhibits architectural problems that will hinder reuse. Circular dependencies, mixed concerns in the utilities module, and unused exports create barriers to splitting it out.

**Verdict**: Ready for isolated use, but requires refactoring before it can be cleanly split into reusable packages. The business logic (pricing, customers) is sound; the blocking issue is structural organization rather than functional correctness.
