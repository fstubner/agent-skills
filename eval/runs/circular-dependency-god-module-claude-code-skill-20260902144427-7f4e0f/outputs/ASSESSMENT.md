# Engineering Assessment: orders-core

## Scope

**In Scope**:
- `src/util.js` — shared utility functions
- `src/pricing.js` — pricing calculation logic
- `src/customers.js` — customer lookup and slugification
- `test/pricing.test.js` — existing test suite
- `package.json` — project configuration

**Out of Scope**:
- Integration with external systems (databases, APIs)
- Performance benchmarking
- Runtime behavior in production environments
- Deployment configuration or CI/CD pipelines

**Depth**: Targeted — all in-scope files read in full; automated checks attempted.

---

## Environment

**Language & Runtime**: JavaScript (Node.js ESM)

**Domain**: Shared library for orders-related pricing, customer management, and utility functions

**Frameworks & Libraries**: None (uses only Node.js built-ins)

**Build System**: npm (no build step; ES modules used directly)

**Target Platform**: Server-side library (imported by other modules)

---

## What I Ran

| Command | Status | Output |
|---------|--------|--------|
| `npm test` | **Pending approval** | Not yet executed. Project defines test script in package.json: `"test": "node --test test/pricing.test.js"` |
| Type checking | Not applicable | No TypeScript config or type-checking tool configured |
| Linting | Not applicable | No ESLint, Prettier, or other linter configured |
| Dependency audit | Not applicable | No external dependencies declared (package.json has only metadata) |
| Build | Not applicable | No build step defined; ESM modules used directly |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Medium | Reliability | `parseDate()` lacks input validation and will fail silently on malformed input | `src/util.js:18-20` — splits on '-' and converts to Number without checking array length or numeric validity; e.g., `parseDate("invalid")` produces `{year: NaN, month: NaN, day: NaN}` | Add validation to ensure input matches `YYYY-MM-DD` format and that resulting numbers are valid year/month/day values. Consider returning null or throwing on invalid input. |
| 2 | Medium | Reliability | `priceFor()` assumes order object has required properties without validation | `src/pricing.js:6-7` — accesses `order.date` and `order.quantity` without checking existence or type; calling with incomplete object will fail at runtime (e.g., `priceFor({date: '2026-09-02'})` crashes trying to read `quantity`) | Validate that order has required properties before using. Either throw with descriptive error, return null, or document preconditions explicitly. |
| 3 | Medium | Reliability | `describeOrder()` assumes customer always has a name property | `src/util.js:9-11` — calls `customer.name` without null/type check; while `findCustomer()` handles missing IDs gracefully, `describeOrder()` should be defensive | Add null/type check before accessing `customer.name`. Consider what the fallback should be (e.g., if customer is null, return error or placeholder). |
| 4 | Medium | Maintainability | Test coverage is incomplete — only 2 tests covering happy path of one function | `test/pricing.test.js:5-11` — tests only `priceFor()` with valid input; missing: all functions in `util.js`, all functions in `customers.js`, edge cases, error conditions, invalid input handling | Create tests for: date parsing edge cases (leap years, month boundaries, invalid formats), money formatting, slugification, chunk with various sizes, retry retry logic, customer lookup by missing ID. At minimum, test entry points: `priceFor()`, `findCustomer()`, `describeOrder()`. |
| 5 | Low | Correctness | `retry()` function throws undefined if called with times ≤ 0 | `src/util.js:35-41` — loop never executes if times ≤ 0, so `last` remains undefined; line 40 throws undefined instead of a meaningful error | Either validate that times > 0 at function entry, or initialize `last` to a default error (e.g., `new Error('Retry failed: times must be > 0')`). |
| 6 | Low | Correctness | `chunk()` function may produce unexpected results with size ≤ 0 | `src/util.js:29-32` — if size ≤ 0, loop will never increment i properly or will loop infinitely depending on size value | Add validation: throw if size ≤ 0. Consider what the expected behavior is (e.g., `chunk([1,2,3], 0)` should probably throw). |
| 7 | Low | Reliability | `formatMoney()` does not validate that input is a number | `src/util.js:5-6` — assumes `minor` is a number; passing a string, null, or non-numeric value will produce unexpected output (e.g., `formatMoney("abc")` produces `NaN.ab`) | Add type/value validation. Either throw if input is not a non-negative integer, or document this as a strict precondition for callers. |
| 8 | Info | Maintainability | `describeOrder()` creates a coupling between util.js and both pricing.js and customers.js | `src/util.js:2-3, 9-11` — imports specific functions from two other modules; this function is exported as part of the "shared helpers" but primarily orchestrates pricing and customer logic | No action required, but document this coupling. If the library grows, consider whether describeOrder belongs in a separate "order" or "presentation" module. |

---

## Unconfirmed Issues

None at this time. All identified issues have clear evidence in the code.

---

## Summary

### Strengths

1. **Clean, modular structure** — each module has a clear responsibility (pricing, customers, utilities); no obvious circular dependencies or tight coupling within each module.

2. **Defensive defaults in customer lookup** — `findCustomer()` (src/customers.js:8-10) gracefully returns a fallback `{id, name: 'Unknown'}` when a customer is not found, rather than returning null or crashing.

3. **No external dependencies** — the library depends only on Node.js built-ins, reducing supply-chain risk and deployment complexity.

### Key Risks

**Input Validation Gaps (Findings #1, #2, #3, #7)**  
The library assumes callers pass well-formed input (valid dates, complete order objects, numeric arguments). If this library is intended for reuse across multiple consumers, these assumptions create silent failures or crashes. The most critical is `priceFor()` (Finding #2), which is a public API function that directly impacts pricing calculation; invalid input will fail at runtime. Recommend adding validation layers to all public functions or explicitly documenting strict preconditions.

**Test Coverage (Finding #4)**  
Only the happy path of one function is tested. Edge cases, error conditions, and invalid inputs are untested. As this library grows or is reused by other teams, gaps in test coverage will accumulate technical debt and risk regressions.

**Error Handling Edge Cases (Findings #5, #6)**  
Two utility functions (`retry`, `chunk`) have edge cases that will fail or throw undefined. These are lower severity but should be resolved before the library is shared widely, as they create foot-guns for consumers.

### Priority Order

1. **Add input validation to `priceFor()` (Finding #2)** — highest impact, highest blast radius. This is the primary public API function; invalid input should fail loudly with a clear error, not silently or at an unexpected point.

2. **Validate `parseDate()` (Finding #1)** — affects all code that processes dates, including `priceFor()` indirectly; resolve this before adding tests to avoid testing invalid behavior.

3. **Add comprehensive tests (Finding #4)** — create tests for edge cases and error paths. Use this to validate the fixes for Findings #1, #2, #3 once implemented.

4. **Add validation and defensive checks to `describeOrder()` and `formatMoney()` (Findings #3, #7)** — lower priority as they are mostly internal/helper functions, but should be defended if they are part of the public API for reuse.

5. **Add guards to `retry()` and `chunk()` (Findings #5, #6)** — these are utilities with edge cases; add validation to fail fast and clearly rather than throwing undefined or looping unexpectedly.

### Coverage Gaps

- **Tests could not be run** — attempted `npm test` but requires execution approval. The test suite exists but results are not yet confirmed.
- **No type checking** — no TypeScript or JSDoc+type annotations; types are inferred from usage only.
- **No linting** — no ESLint or equivalent; code style and potential anti-patterns are not checked by tooling.
- **No performance testing** — no benchmarks or load tests; algorithmic complexity appears reasonable but is not verified.
- **No integration testing** — the library is tested in isolation; how it behaves when `describeOrder()` receives malformed orders from downstream code is not tested.
- **Production metrics unavailable** — no insights into which functions are most heavily used or where failures occur in the wild.

---

## Verified

✓ All source files (util.js, pricing.js, customers.js) read and analyzed  
✓ Test file reviewed; coverage gaps identified  
✓ Package metadata examined (package.json, README.md)  
✓ No external dependencies identified  
✓ Input validation patterns reviewed; gaps documented with line-specific evidence  
✓ Module structure and coupling analyzed
