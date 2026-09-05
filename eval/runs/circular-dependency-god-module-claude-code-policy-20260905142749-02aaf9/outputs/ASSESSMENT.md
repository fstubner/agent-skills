# orders-core Package Assessment

## Summary
A small orders management library (181 LOC) providing pricing calculations, customer lookups, and shared utilities. Tests pass (2/2). The package has fixable architectural issues and incomplete test coverage that should be addressed before splitting for reuse.

## Architecture & Dependencies

### Circular Dependencies
The three source modules form a circular dependency graph:
- `util.js` imports from `pricing.js` and `customers.js`
- `pricing.js` imports from `util.js`
- `customers.js` imports from `util.js`

While Node.js ES modules tolerate this pattern, it creates tight coupling and makes the module structure ambiguous. The public API is unclear—`util.js` is listed as main entry, but all three modules are semantically standalone domains.

### Overloaded util.js
`util.js` is labeled "shared helpers" but mixes four unrelated categories:
1. **Domain logic**: `describeOrder()`, `isWeekend()`, `parseDate()`
2. **Infrastructure**: `retry()`, `chunk()`
3. **Formatting**: `formatMoney()`, `slugify()`

This makes the module a junk drawer. `describeOrder()` particularly couples pricing and customer domains by pulling both into the same function.

## Code Quality

### Input Validation Gaps
- `parseDate()` splits on `-` and maps to Number with no validation. Invalid inputs (wrong format, out-of-range months/days) silently produce broken date objects.
- `isWeekend()` trusts `parseDate()` output without checking.
- `findCustomer()` has no ID validation; unknown IDs return a placeholder with an unknowable name.
- `priceFor()` assumes `order.date` and `order.quantity` exist and are well-formed.

### Error Handling
- `retry()` throws the last caught error with no context about how many retries occurred or what was retried.
- No logging or error messages for failed operations.

### Unused Exports
The README claims "everything [in util.js] is used somewhere," but two functions are dead code:
- `chunk()` — defined, exported, never called
- `retry()` — defined, exported, never called

Keeping unused exports increases the API surface for consumers without benefit.

## Testing Coverage

- **Pricing logic**: 2 tests covering the happy path (weekday and weekend surcharges). ✓
- **Customers module**: Zero tests. No validation of lookups, slug generation, or unknown customer behavior.
- **Utility functions**: Zero tests. No tests for date parsing, formatting, slugification, chunking, or retry logic.
- **Error paths**: No tests for invalid inputs, malformed dates, or retry exhaustion.

Test dates are hardcoded constants; unclear if they cover all edge cases or calendar quirks.

## Reusability Concerns

### Unclear Scope
- Is this a pricing engine, a customer manager, or a utility library? Current structure suggests all three loosely bundled.
- Consumers can't tell which functions are stable internal helpers vs. intended public API.

### Tight Coupling
- `describeOrder()` requires both pricing and customer logic in a single call, preventing independent use of either domain.
- `customerSlug()` depends on hardcoded CUSTOMERS array; can't be used with external customer sources.

### Hardcoded Data
- The CUSTOMERS array is embedded in `customers.js` with no way to inject alternative sources or extend it.
- Makes the module unsuitable for integration into larger systems.

### Data Format Assumptions
- Date format is assumed to be `YYYY-MM-DD` with no fallback or validation.
- Order shape (quantity, date, customerId) is implicit; no schema or documentation.

## Correctness Verification

**Tests run**: ✓ Both pass
**Runtime**: No crashes on test inputs
**Date logic**: Verified `2026-09-02` is correctly identified as weekday (Wednesday) and `2026-09-05` as weekend (Saturday)
**Surcharge calculation**: Correctly applies 500 units (¢5.00) surcharge on weekends

## Recommendations for Split & Reuse

**Before extracting as a shared package:**

1. **Resolve circular dependencies**: Reorganize into a clean hierarchy (e.g., util → domain logic → customers/pricing) or split into separate packages.

2. **Validate inputs**: Add bounds checking and type validation for `parseDate()`, `priceFor()`, and `findCustomer()`. Fail fast on invalid input.

3. **Expand test coverage**: Add tests for all three modules, including edge cases (leap years, month boundaries, unknown customers, zero quantities).

4. **Remove dead code**: Delete `chunk()` and `retry()` or document their intended use before export.

5. **Decouple domains**: Extract `describeOrder()` to a separate adapter layer if it's needed at all. Let consumers compose pricing + customers as needed.

6. **Make configuration injectable**: Accept customer data, surcharge rules, or date formats as constructor/function arguments, not hardcoded.

7. **Document the public API**: Clearly mark which functions/modules are stable exports vs. internal.

## Current Fit for Reuse
**Not recommended for extraction as-is.** The package works for its current use case but requires architectural cleanup, expanded testing, and explicit API boundaries before it's stable enough to depend on as a shared library.
