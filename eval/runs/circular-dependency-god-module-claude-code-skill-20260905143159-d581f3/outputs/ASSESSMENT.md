# Engineering Assessment: orders-core

## Scope

**In scope**: 
- `src/util.js` — shared utility functions (6 exports)
- `src/pricing.js` — pricing calculation logic
- `src/customers.js` — customer lookup and management
- `test/pricing.test.js` — test suite
- `package.json` — project metadata and scripts

**Out of scope**:
- `.agent-input/` — assessment infrastructure
- `node_modules/` — external dependencies
- `.git/` and configuration files

**Depth**: Targeted — all files in scope read in full; code examined for correctness, reliability, architecture, and maintainability.

---

## Environment

**Language & Runtime**: JavaScript (ES modules), Node.js 16+ (`node:test` built-in)

**Frameworks & Libraries**: None (plain Node.js)

**Domain**: Business logic library for order processing (pricing, customers, shared utilities)

**Platform**: Backend/library; used as a reusable module

**Build System**: npm (ES modules)

**No TypeScript, no framework dependencies.**

---

## What I Ran

| Tool | Command | Result |
|------|---------|--------|
| Tests | `npm test` | ✅ **PASS** — 2 tests pass, 0 fail (pricing calculations for weekday and weekend orders) |
| Build | `npm run build` | ❌ Not configured — no build script in package.json |
| Lint | ESLint | Not attempted (no linter configured) |
| Type check | TypeScript | Not applicable (plain JavaScript) |
| Audit | `npm audit` | Not run (requires approval, no production dependencies listed) |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | `parseDate()` lacks input validation; malformed dates produce undefined values | `src/util.js:18-20` — no check for 3-part split result; `parseDate("2026-09")` yields `{year: 2026, month: 9, day: undefined}`; `isWeekend()` then passes `undefined` to `Date.UTC()`, causing incorrect day-of-week calculation | Validate input format in `parseDate()`: check that `split('-')` returns exactly 3 numeric parts, or throw/return an error for malformed dates. Add test cases for edge cases: incomplete dates, non-numeric parts, null/undefined input. |
| 2 | Medium | Maintainability | Severe test coverage gap; only 1 of 7 exported functions tested | `test/pricing.test.js` tests only `priceFor()` indirectly; untested: `formatMoney()`, `describeOrder()`, `slugify()`, `parseDate()`, `isWeekend()`, `chunk()`, `retry()`, plus `findCustomer()` and `customerSlug()` in customers module | Add tests for each exported function, prioritizing: (a) `isWeekend()` — date handling edge cases; (b) `formatMoney()` — boundary values; (c) `retry()` — success and exhaustion paths; (d) `parseDate()` — valid and invalid formats; (e) helper functions used in critical paths. |
| 3 | Medium | Reliability | `retry()` lacks backoff or delay between attempts; busy-wait retry can overwhelm external services or consume CPU | `src/util.js:35-41` — loop re-tries `fn()` immediately on each failure without any delay or exponential backoff | Add optional `delay` parameter (milliseconds) or implement exponential backoff (e.g., `delay = initialDelay * Math.pow(2, attemptNumber)`). For synchronous retry, document that it is for synchronous failures only and not suitable for network/async operations. |
| 4 | Low | Maintainability | `src/util.js` houses 6 unrelated utility functions; README notes "has grown a bit"; further growth will impact cohesion | `src/util.js:1-42` — contains money formatting, order descriptions, text slugification, date parsing, day-of-week checks, array chunking, and retry logic; no shared responsibility ties these together | As the module grows, consider splitting by domain: (a) `date-utils.js` (parseDate, isWeekend), (b) `format-utils.js` (formatMoney, slugify), (c) `math-utils.js` (chunk), (d) `retry-utils.js` (retry). Keep only functions that are truly cross-cutting in `util.js`. This is a future concern; current size is still manageable. |

---

## Unconfirmed Issues

No additional unconfirmed issues requiring investigation. All findings above are based on direct code examination.

---

## Summary

### Strengths

1. **Passing test suite**: Both test cases pass without errors; happy-path pricing logic works correctly (src/test/pricing.test.js).
2. **Defensive defaults**: `findCustomer()` uses nullish coalescing (`??`) to return a safe default for unknown customer IDs, avoiding null reference errors (src/customers.js:9).
3. **Simple, readable code**: No complex abstractions or hard-to-follow logic; functions are small and purpose-clear.

### Key Risks

1. **Date parsing correctness (Finding #1, High)**: `parseDate()` does not validate input format. Passing a date like "2026-09" or "invalid" will result in `undefined` day values, causing incorrect day-of-week calculations and pricing errors. This directly affects the pricing module's correctness and should be addressed before any reuse.

2. **Untested functions (Finding #2, Medium)**: 6 of 7 utility functions have zero test coverage. Critical paths like `isWeekend()` (used by pricing) lack validation of edge cases. The retry function has no way to verify correct error propagation behavior.

3. **Retry behavior unsuitable for production (Finding #3, Medium)**: The `retry()` function has no delay or backoff, making it unsuitable for recovering from transient failures (e.g., network calls) and potentially harmful if retrying work on overloaded services.

### Priority Order

1. **Fix `parseDate()` validation (Finding #1)** — blocks safe reuse of the pricing module. Add input validation and test cases for malformed dates. Estimated effort: 30 minutes.

2. **Add test coverage for `isWeekend()` and `parseDate()` (Finding #2, part a)** — these functions are on the critical path for pricing. Estimated effort: 1 hour.

3. **Document or refactor `retry()` (Finding #3)** — clarify whether it's for sync-only use or add backoff logic. If this module is reused for network operations, this is urgent. Estimated effort: 1–2 hours depending on scope.

4. **Expand test coverage for remaining utilities (Finding #2, remaining)** — medium priority, improves maintainability and confidence in reuse. Estimated effort: 2 hours.

5. **Consider future refactoring of `util.js` (Finding #4, Low)** — not urgent for current reuse, but plan for this as the module grows.

### Coverage Gaps

- **No linting or code style enforcement**: ESLint or similar is not configured. No automated checks for naming consistency, unused variables, or import ordering.
- **No type checking**: The codebase uses plain JavaScript; TypeScript or JSDoc-based type checking could catch some issues early (e.g., `parseDate()` receiving unexpected types).
- **No integration tests**: Tests cover unit logic only; no tests of how pricing, customers, and utilities work together in a real order-processing flow.
- **No performance testing**: No benchmarks for functions like `chunk()` or `retry()` on large datasets.
- **No audit of dependencies**: npm audit was not run due to approval requirements, but the package.json shows no explicit dependencies (only devDeps would be for testing/build tools if present).
- **No mutation or property-based testing**: Current tests only verify specific hardcoded inputs; edge cases and boundary values are not systematically tested.

---

## What Was Verified

✅ Project structure and entry point identified (ES module, npm-based)
✅ All source files read and examined (3 modules + 1 test file)
✅ Tests executed successfully (2 passing)
✅ Critical logic paths traced: pricing → isWeekend → parseDate
✅ Correctness issues identified: parseDate input validation gap
✅ Reliability issues identified: retry behavior and test coverage
✅ Code organization noted for future maintainability
