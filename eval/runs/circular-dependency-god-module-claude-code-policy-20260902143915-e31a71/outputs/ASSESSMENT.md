# Orders Core - Reuse Assessment

## Overview
`orders-core` is a small Node.js ESM package (no external dependencies) providing pricing calculation, customer lookup, and shared utility functions. The entry point is `src/util.js`. It is well-structured and ready for limited reuse with documented caveats.

## Strengths

### Architecture & Cohesion
- **Clear module separation**: Three focused modules with distinct responsibilities (pricing, customers, utilities).
- **No external dependencies**: Pure Node.js implementation using only standard library APIs.
- **ESM module system**: Modern JavaScript module format is standard and portable.
- **Minimal, focused exports**: Each module exports only what it needs.

### Code Quality
- **Readable implementations**: Code is straightforward and easy to follow without unnecessary complexity.
- **No premature abstraction**: Utilities in `util.js` solve real problems across the codebase; nothing is over-engineered.
- **Appropriate error handling**: Functions provide sensible defaults (e.g., `findCustomer` returns `{ id, name: 'Unknown' }` for missing customers).
- **Date handling**: Correctly uses UTC for weekend calculations via `Date.UTC` to avoid timezone issues.

### Testing
- **Existing test coverage**: Pricing calculation has test cases for both weekday and weekend scenarios.
- **Uses Node.js native test framework**: No external test dependencies; simple and portable.

## Concerns

### Input Validation at Trust Boundaries
- **parseDate()** (line 18-20): Assumes well-formed input (`YYYY-MM-DD` format). No validation that values actually produce valid dates (e.g., `2026-02-30` would not error until `Date.UTC`).
- **priceFor()** (line 5-7): Assumes `order` object has valid `date` and `quantity` fields. No type checks or presence validation.
- **findCustomer()** (line 8-9): Gracefully handles missing customers but no validation of `id` format.
- **Impact**: If this is consumed at an API boundary, upstream callers can pass malformed data without immediate feedback.

### Incomplete Test Coverage
- **Only pricing module is tested**: `util.js` functions (`formatMoney`, `slugify`, `chunk`, `retry`, `isWeekend`) lack test coverage.
- **Edge cases uncovered**: No tests for empty/null inputs, boundary dates (e.g., year boundaries), or error paths (e.g., `retry` exhaustion, invalid date strings).
- **Risk**: Bugs in utilities become consumer responsibility to discover.

### Module Entry Point Confusion
- **package.json points to `src/util.js`**: This means importing the package imports utility functions, not the business logic modules. Consumers need to import pricing/customers explicitly if needed.
- **Design intent unclear**: Is this a utilities-first package, or should it be a facade that orchestrates pricing/customers?

### Undocumented Contract Details
- **Money units**: `formatMoney` assumes input is in minor units (cents). Not documented.
- **Surcharge value**: Hardcoded `500` in pricing suggests cents but nowhere is this explained.
- **Date format**: `parseDate` expects ISO-like format (`YYYY-MM-DD`) but no JSDoc or type hints.
- **Risk for consumers**: Hidden contracts lead to integration bugs.

### Potential Circular Dependency Risk
- **util.js → pricing.js → util.js**: The chain `util.js` imports `pricing.js` imports `util.js` (for `isWeekend`) is acyclic in practice because pricing only uses `isWeekend` at runtime. However, this pattern is fragile and could break if refactored carelessly.

### No Type Safety
- **Zero TypeScript/JSDoc**: No type annotations means consumers have no IDE/linter support for discovery or validation.
- **Impact**: Requires consumers to read the source or trial-and-error to understand function signatures and expectations.

## Reuse Readiness Verdict

### Ready for:
- **Internal use within the same organization** where contracts can be established via code review.
- **Pricing and customer domain logic** if wrapped with input validation at call sites.
- **Utility functions** if the domain contracts (money in cents, date in `YYYY-MM-DD`) are documented externally.

### Not ready for:
- **Public/open-source reuse** without type annotations or comprehensive tests.
- **Consumer use at trust boundaries** (API handlers, user input) without validation layers.
- **Adoption as a utility library** without documentation of assumptions (money units, date format, surcharge logic).

## Recommendations Before Splitting Out

1. **Add input validation** at domain boundaries (e.g., validate `order` shape in `priceFor`, sanitize date strings in `parseDate`).
2. **Document contracts via JSDoc** or TypeScript types. At minimum, specify:
   - Expected input types and formats (e.g., `date: 'YYYY-MM-DD' string`, `quantity: integer >= 1`).
   - Units of money (assume cents).
   - Behavior on invalid input (throw vs. default vs. null).
3. **Expand test coverage** to include:
   - Edge cases (empty strings, nulls, boundary dates).
   - Error paths (`retry` exhaustion, invalid date format).
   - Each utility function in `util.js`.
4. **Clarify the entry point**: If `src/util.js` is the public API, document whether that's intentional. Otherwise, consider a barrel export or facade.
5. **Consider type safety**: Either add JSDoc with type annotations for IDE support, or migrate to TypeScript if this becomes a shared library.

## Verification Completed
✓ Reviewed all source files for logic, dependencies, and error handling.
✓ Confirmed package.json structure and entry point.
✓ Analyzed test coverage and identified gaps.
✓ Validated module cohesion and circular dependency risk.
✓ Assessed input validation at trust boundaries.
