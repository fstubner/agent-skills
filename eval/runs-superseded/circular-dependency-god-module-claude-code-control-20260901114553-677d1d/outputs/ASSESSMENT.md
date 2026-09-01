# Package Assessment: orders-core

## Overview
`orders-core` is a small Node.js package that provides pricing calculations, customer management, and shared utility functions for an orders domain. It exports 10 functions across three modules: `customers.js`, `pricing.js`, and `util.js`.

## Strengths

### Dependencies
- No external dependencies, only Node.js built-ins (best-in-class for reuse)
- Pure JavaScript, no platform-specific code
- Uses ESM modules (modern standard, widely supported)

### Code Quality
- Clean, readable implementation
- Consistent code style and formatting
- No obvious runtime bugs
- Compact and efficient implementations

### Scope
- Focused domain (orders)
- Clear separation between customers and pricing modules
- Well-defined core functionality

## Reusability Concerns

### 1. Incomplete Public API Definition
- `package.json` lacks version, repository, license, and keywords
- `main` field points only to `util.js`; no documented entry points for `customers.js` or `pricing.js`
- No type definitions (TypeScript) or JSDoc comments for consumers
- **Impact**: Consumers cannot confidently import specific modules or rely on stable exports

### 2. Utility Module Lacks Cohesion
- `util.js` mixes four distinct concerns:
  - Business logic (`describeOrder`, `formatMoney`) — depends on domain functions
  - Domain helpers (`parseDate`, `isWeekend`, `slugify`) — orders-specific
  - Generic utilities (`chunk`, `retry`) — domain-agnostic, could live elsewhere
- README acknowledges "it has grown a bit" but offers no organization plan
- **Impact**: Consumers importing `util.js` get tightly coupled domain logic mixed with reusable primitives; generic functions are buried and lack documentation

### 3. Insufficient Test Coverage
- Only 2 tests covering `priceFor()` (happy path only)
- Missing tests for:
  - `customers.js` module (findCustomer, customerSlug)
  - 7 of 10 exported functions in util
  - Edge cases (e.g., boundary dates, empty inputs, invalid date formats)
  - Error conditions (retry exhaustion, malformed data)
- **Impact**: Consumers cannot verify correctness; maintenance risk is high

### 4. Undocumented Behavior & Assumptions
- `findCustomer()` silently returns a fallback `{ id, name: 'Unknown' }` — behavior may be surprising
- `isWeekend()` uses UTC dates without documenting timezone assumptions
- `retry()` catches all errors but only throws the last one — error details are lost
- `parseDate()` expects 'YYYY-MM-DD' format without validation; fails silently on malformed input
- **Impact**: Consumers may encounter unexpected behavior and debugging is difficult

### 5. Circular Import Risk
- `util.js` imports and uses `priceFor()` and `findCustomer()`
- `pricing.js` and `customers.js` import from `util.js`
- This creates a dependency graph that is non-standard for utility modules and hard to refactor
- **Impact**: Difficult to split or reuse components independently

### 6. No Versioning or Stability Guarantees
- No semver version in `package.json`
- No CHANGELOG or API stability policy
- **Impact**: Consumers have no way to manage compatibility

## Specific Issues

1. **describeOrder()** — Tightly couples money formatting, customer lookup, and pricing. Difficult to reuse if the order format or pricing rules diverge.
2. **retry()** — Generic but untested; implementation choices (loop counter, single throw) may not suit all use cases.
3. **chunk()** — Generic utility with no tests; use case unclear from context.
4. **parseDate()** — Fragile; assumes valid 'YYYY-MM-DD' input but provides no error feedback.

## Readiness for Reuse

### Required Before Splitting
- [ ] Add version, license, repository fields to `package.json`
- [ ] Define and document the public API (separate generic utilities from domain logic)
- [ ] Provide JSDoc or TypeScript definitions for all exports
- [ ] Add comprehensive tests (>80% coverage, edge cases)
- [ ] Document assumptions (timezone, date format, error handling)

### Recommended Before Splitting
- [ ] Reorganize `util.js` into cohesive modules (e.g., `domain-helpers.js` vs. `generics.js`)
- [ ] Add error handling and validation for `parseDate()` and other inputs
- [ ] Document the error behavior of `retry()` and when to use it
- [ ] Write a CHANGELOG and versioning policy
- [ ] Consider deprecating or documenting the fallback behavior of `findCustomer()`

## Conclusion

The package has a solid foundation with clean code and zero external dependencies. However, it is **not yet ready for reuse** in its current state. The primary barriers are:
1. Incomplete metadata and no documented public API
2. Insufficient test coverage
3. Mixed concerns in the utility module
4. Undocumented assumptions and behavior

Addressing the "Required Before Splitting" items would establish a minimum viable product. The "Recommended" items would significantly improve robustness and consumer experience.
