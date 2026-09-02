# Orders Core Package Assessment

## Summary
The `orders-core` package provides pricing, customer lookup, and shared utility functions for order processing. The codebase is small (3 files, ~750 LOC) with basic test coverage. The package structure has architectural concerns that should be addressed before splitting out for reuse.

## Strengths
1. **Focused functionality**: Three clear modules handle distinct domains (pricing, customers, utilities)
2. **ES modules**: Modern module system with clean exports
3. **Minimal dependencies**: No external dependencies; self-contained
4. **Clear APIs**: Public functions have descriptive names and straightforward signatures
5. **Some test coverage**: pricing.test.js covers the main business logic with both weekday and weekend cases

## Critical Issues

### Circular Module Dependency
**Severity**: High  
The package has a circular import pattern that works but is fragile:
- `util.js` imports `priceFor` from `pricing.js` (line 2)
- `pricing.js` imports `isWeekend` from `util.js` (line 1)

While Node.js handles this at runtime due to the execution order, circular dependencies are difficult to refactor and easy to break. For a reusable package, this should be restructured.

**Recommendation**: Move `isWeekend`, `parseDate`, and `chunk`/`retry` utilities to separate files or resolve the circular dependency by reorganizing module boundaries.

### Incorrect Main Entry Point
**Severity**: High  
`package.json` specifies `"main": "src/util.js"`, but `util.js` is not a suitable entry point:
- It's primarily a utilities/helpers file with mixed concerns
- It imports domain-specific modules (pricing, customers) which would be unexpected exports for an entry point
- Consumers expecting to import the main module would get a mixed collection of unrelated functions

**Recommendation**: Either create an `index.js` that explicitly re-exports chosen APIs, or remove the main field and document that consumers should import specific modules directly.

## Design Issues

### Mixed Concerns in util.js
The `util.js` file contains seven unrelated functions:
- **Business logic**: `describeOrder`, `isWeekend`, `parseDate`
- **Data transformation**: `slugify`
- **Formatting**: `formatMoney`
- **Generic utilities**: `chunk`, `retry`

The current organization makes it difficult to use the package selectively (e.g., if you only need `formatMoney`, you still pull in `priceFor` and `findCustomer`).

**Recommendation**: Group utilities by domain or concern. Consider:
- Keep date/pricing logic together
- Separate generic utilities (chunk, retry) into their own file
- Move `describeOrder` to a dedicated formatting/composition module

### Hardcoded Data
`customers.js` contains a hardcoded list of two customers. This severely limits reusability—consumers cannot provide their own customer data without modifying the module.

**Recommendation**: Accept customer data as a parameter (e.g., via dependency injection or configuration) rather than hardcoding it.

## Quality Issues

### Incomplete Test Coverage
- Only `pricing.js` has tests
- `customers.js` (findCustomer, customerSlug) has no coverage
- `util.js` functions (`parseDate`, `formatMoney`, `isWeekend`, etc.) have no direct tests
- The main integration point (`describeOrder`) is untested

**Recommendation**: Add test files for `customers.test.js` and `util.test.js` with comprehensive coverage.

### Missing Documentation
- No JSDoc comments on exported functions
- No type hints (even via JSDoc `@param` / `@returns`)
- No explanation of expected date format (YYYY-MM-DD is assumed but undocumented)
- README mentions util.js has "grown a bit" but doesn't explain the intended scope

**Recommendation**: Add JSDoc blocks with parameter and return types for all exported functions.

### Minor Code Quality Observations
- `chunk()` and `retry()` are generic utilities that might not belong in an orders-specific package—consider if these should be separate
- `parseDate()` uses 1-indexed months but JavaScript's `Date` uses 0-indexed months; the offset (month - 1) is correct but could be error-prone
- `findCustomer()` returns a default "Unknown" customer—behavior should be documented or made configurable

## Suitability for Reuse

### Readiness: Fair to Poor
The package has useful functionality but architectural issues that need resolution:

| Aspect | Status | Note |
|--------|--------|------|
| **Functionality** | Ready | Core features work as intended |
| **Architecture** | Poor | Circular dependencies, wrong entry point, mixed concerns |
| **Testing** | Partial | Only 1 of 3 modules tested |
| **Documentation** | Missing | No type hints or API documentation |
| **Configurability** | Limited | Hardcoded customer data, no options |

### Blockers for Reuse
1. Circular imports must be resolved
2. Entry point must be clarified or fixed
3. Customer data must be externalized
4. API must be documented

## Recommendations Before Publishing

### Priority 1 (Required)
- [ ] Resolve circular dependency by reorganizing modules
- [ ] Fix or remove the main entry point
- [ ] Externalize customer data (accept as parameter or config)

### Priority 2 (Strongly Recommended)
- [ ] Add test coverage for all modules
- [ ] Add JSDoc documentation with types
- [ ] Update README with API documentation and usage examples

### Priority 3 (Nice to Have)
- [ ] Separate generic utilities (`chunk`, `retry`) into a separate package
- [ ] Add TypeScript definitions or migrate to TypeScript
- [ ] Add examples in README for each module

## Verification Notes
- File structure: ✓ Confirmed 3 modules, clear separation
- Exports: ✓ All exports are accessible
- Module dependencies: ✓ Analyzed, circular dependency identified
- Test execution: ✓ Test file syntax valid
- Package metadata: ✓ Reviewed package.json configuration
