# Package Assessment: orders-core

## Overview
This is a small Node.js ESM module (42 lines core logic) providing pricing calculations, customer lookups, and shared utilities. The package shows focused functionality but has architectural issues and gaps in test coverage that should be resolved before splitting out for reuse.

## Structure Analysis

### Scope
- **Entry point**: src/util.js (shared utilities dumping ground)
- **Modules**: 3 domain files (pricing, customers, util) + 1 test file
- **Size**: ~66 lines of application code, 12 lines of tests
- **Maturity**: Minimal test coverage

### Module Breakdown

#### `src/pricing.js` (9 lines)
- Single export: `priceFor(order)` — calculates order price with weekend surcharge
- Logic: BASE_MINOR * quantity + (500 if weekend else 0)
- Tests: 2 tests (weekday, weekend cases)
- Assessment: Tight, focused logic; good test coverage for this module

#### `src/customers.js` (15 lines)
- Static customer database (hardcoded 2 records)
- Exports: `findCustomer(id)`, `customerSlug(id)`
- Assessment: No tests; hardcoded data limits reusability; fallback to "Unknown" customer is defensive

#### `src/util.js` (42 lines)
- 7 utility functions: formatMoney, describeOrder, slugify, parseDate, isWeekend, chunk, retry
- Assessment: Mixed bag — some utilities are order-domain-specific (describeOrder), others are generic (chunk, retry)

## Critical Issues

### 1. Circular Dependency (HIGH PRIORITY)
```
util.js → pricing.js → util.js (isWeekend)
util.js → customers.js → util.js (slugify)
```
- `util.js` imports from `pricing.js` and `customers.js` (lines 2-3)
- Both `pricing.js` and `customers.js` import from `util.js`
- This is a module graph cycle that works in Node.js but indicates unclear separation of concerns
- **Impact**: Extraction as separate package will force breaking this cycle; unclear how

### 2. No Input Validation at Trust Boundaries
- `parseDate(value)` — no validation on format; will crash on malformed dates
- `priceFor(order)` — assumes order.date exists and is a valid string
- `describeOrder(order)` — assumes order.customerId exists
- `formatMoney(minor)` — no type checking; assumes numeric input
- `chunk(rows, size)` — no validation that size > 0
- `retry(fn, times)` — no validation on times parameter
- **Impact**: Callers can trivially cause runtime errors; no clear error contract

### 3. Inadequate Test Coverage
- Only 2 tests total (both for pricing.js)
- Zero tests for util.js (7 functions untested)
- Zero tests for customers.js
- Zero tests for edge cases (empty strings, null, undefined, invalid dates)
- **Impact**: Risk of silent failures when extracted

### 4. Module Cohesion Issues
- `util.js` contains both domain-specific code (describeOrder, priceFor import) and generic utilities (chunk, retry)
- README acknowledges it has "grown a bit" but lacks clear boundaries
- **Impact**: Hard to extract; unclear what stays/goes when splitting

## Reusability Assessment

### Strengths
- Small, readable code
- No external dependencies
- Focused domain (pricing/orders)
- Some utilities are genuinely generic (chunk, retry, slugify)

### Weaknesses
- **Unclear data model**: Customers hardcoded; pricing assumes specific order shape
- **No API contract**: No JSDoc, no types, no validation
- **Insufficient tests**: Can't validate extraction didn't break behavior
- **Ambiguous ownership**: describeOrder in util.js mixes pricing + customers logic
- **No export documentation**: Which functions are stable? Which are internal?

## Material Unknowns

1. **Architecture intent**: Is the circular dependency intentional (util as orchestrator) or accidental?
2. **Extraction scope**: Which functions go to the extracted package? All of util.js? Just pricing?
3. **Backwards compatibility**: Are there external consumers already? What stability guarantee is needed?
4. **Error handling**: Should invalid dates throw or return fallback values?
5. **Data model**: Will customers remain hardcoded or become dynamic? What does the extracted package own?
6. **Deployment strategy**: Is this a published npm package or internal code reuse?

## Recommendations Before Extraction

### Must Address
1. Break the circular dependency — clarify whether util orchestrates pricing/customers or each is independent
2. Add input validation at public API boundaries with clear error contracts
3. Expand test suite to cover util.js and customers.js; add edge cases
4. Document which exports are stable vs. internal

### Should Address
1. Separate domain-specific orchestration (describeOrder) from generic utilities (chunk, retry)
2. Define customer data source (static? dynamic? parameterized?)
3. Add JSDoc to exported functions specifying input/output types and error cases

### Nice to Have
1. Consider if chunk/retry belong in a separate generic-utils package
2. Type annotations (JSDoc or TypeScript) for clarity

## Verification Checklist
- [x] Code structure reviewed
- [x] Dependencies traced (circular cycle identified)
- [x] Test coverage assessed (insufficient)
- [x] Input validation checked (missing)
- [x] Documentation reviewed (sparse)
- [ ] Tests run (awaiting environment approval)
- [ ] Use cases/consumers identified (out of scope)

## Conclusion

**Readiness**: Not ready for extraction without architectural clarification.

The package contains solid core logic but exhibits typical "grab bag" module problems (circular dependencies, weak contracts, sparse testing). The circular dependency and missing validation are the critical blockers. Before splitting out for reuse, resolve the dependency cycle, establish clear API contracts with validation, and expand test coverage to at least 80% of util.js functions. Once addressed, this will be a clean, reusable mini-package.
