# Engineering Assessment: orders-core

## Scope

**In Scope:**
- `src/` directory: All application source files (util.js, pricing.js, customers.js)
- `test/` directory: Test suite
- `package.json`: Project configuration
- `README.md`: Documentation

**Out of Scope:**
- `.agent-input/` directory: Assessment input files
- External dependencies (none declared)
- Production deployment configuration
- Performance/load testing
- Integration with external systems

**Depth: Targeted** — All in-scope files read in full; automated checks run; codebase is small enough for comprehensive review.

---

## Environment

**Languages & Runtime:**
- JavaScript (ES modules)
- Node.js v24.14.1

**Frameworks & Libraries:**
- Node.js built-in `test` module (testing)
- Node.js built-in `assert` module (assertions)
- No external npm dependencies

**Domain:**
- Library providing order pricing, customer lookup, and shared utility functions
- Intended for reuse as described in README: "Pricing, customers and shared helpers"

**Build System:**
- npm scripts only; no build step defined

---

## What I Ran

| Command | Status | Output |
|---------|--------|--------|
| `npm test` | ✅ Pass | 2 tests pass, 0 fail; duration 105.5ms |
| `npm run build` | ⚠️ N/A | No build script defined in package.json |
| Linting | ⚠️ N/A | No linter configured |
| Type checking | ⚠️ N/A | No type checker configured (no TypeScript/JSDoc) |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | `chunk()` infinite loop with invalid size | `src/util.js:29-33` — `chunk([1,2,3,4,5], 0)` exhausts heap; the loop condition `i < rows.length; i += size` never increments when `size ≤ 0`, causing infinite allocation | Add validation: `if (size <= 0) throw new Error('size must be positive')` or `if (size <= 0) return []` at line 30 |
| 2 | High | Correctness | `formatMoney()` produces invalid output for negative values | `src/util.js:5-7` — Test result: `formatMoney(-250)` returns `"-3.-50"` (invalid). Issue: `Math.floor(-250/100)` = -3; `(-250 % 100)` = -50 (negative remainder in JS). Expected: `"-2.50"` | Handle negative amounts correctly: detect sign, format absolute value, apply sign to result, or document that function expects non-negative values only |
| 3 | High | Reliability | `parseDate()` crashes on non-string input | `src/util.js:18-21` — Test result: `parseDate(123)` throws `TypeError: value.split is not a function`. Function assumes string without validation | Add input validation: check `typeof value === 'string'` or add JSDoc type hint and validate before `.split()` |
| 4 | High | Reliability | `parseDate()` produces invalid date objects for malformed input | `src/util.js:18-21` — Test result: `parseDate('2026/09/05')` silently returns `{year: NaN, month: undefined, day: undefined}`. No validation of date format or component ranges (month 1-12, day 1-31) | Add format validation (require `YYYY-MM-DD` pattern) and range checks for month/day before returning the object |
| 5 | High | Maintainability | Test coverage extremely limited | `test/pricing.test.js:1-11` — Only 2 tests total, both for `priceFor()` only. No tests for 7 exported functions from util.js and 2 from customers.js (11 of 13 public functions untested) | Add tests for: `formatMoney()` (including negative/edge cases), `chunk()`, `retry()`, `parseDate()`, `isWeekend()`, `slugify()`, `findCustomer()`, `customerSlug()`, `describeOrder()` |
| 6 | Medium | Architecture | Circular module dependency | `src/util.js:2` imports `priceFor` from `pricing.js`; `src/pricing.js:1` imports `isWeekend` from `util.js`. While currently functional (functions don't call each other at initialization), this fragile pattern will break if module initialization order changes or init-time code is added | Refactor: move `isWeekend()` to a separate module (e.g., `date-utils.js`) to break the cycle, or move pricing logic into `util.js` if it's truly shared |
| 7 | Medium | Reliability | `retry()` lacks backoff strategy | `src/util.js:35-41` — Function retries immediately with no delay between attempts. For transient failures, tight-loop retries waste CPU and may worsen server load (no backoff). For timeouts/IO, immediate retry doesn't help | Consider adding an optional delay or backoff parameter (e.g., exponential backoff: `ms * Math.pow(2, attempt)`), or document that this is for synchronous failures only |
| 8 | Medium | Maintainability | Missing type safety | No JSDoc type hints, TypeScript, or parameter validation across all public functions. Callers have no IDE support or static guarantees for argument/return types | Add JSDoc `@param` and `@return` type annotations to all exported functions (minimal effort, high clarity for a reusable library). Example: `/** @param {string} text @return {string} */` |
| 9 | Low | Maintainability | Silent fallback in `findCustomer()` | `src/customers.js:8-10` — Returns `{id, name: 'Unknown'}` for missing customers. No logging or error signal. Callers may not realize data is incomplete | Add a warning log (if logging available), or document this behavior clearly in JSDoc, or return `null` to force callers to handle missing customers explicitly |

---

## Unconfirmed Issues

**None.** All findings above are confirmed with reproducible test results or direct code inspection.

---

## Summary

### Strengths

1. **Solid test pass rate** — Tests that exist (2 tests) pass reliably and validate core pricing logic.
2. **Clean, readable code** — Functions are short, single-purpose, and well-named. No unnecessary abstraction.
3. **Proper ES module structure** — Uses modern JavaScript standards with clear import/export boundaries.
4. **No external dependencies** — Reduces supply chain risk and keeps the library lightweight for reuse.

### Key Risks

**Critical:**
- **Finding #1 (chunk() infinite loop)** — A single call with `size ≤ 0` crashes the entire process. This is a hard blocker for reuse in any system that might receive untrusted input.

**High:**
- **Finding #2 (formatMoney negative handling)** — Produces garbage output for negative amounts; unacceptable for a pricing library.
- **Finding #3, #4 (parseDate crashes and accepts garbage)** — Core date logic is fragile; used by `isWeekend()` which affects pricing calculations.
- **Finding #5 (test coverage)** — Only 2 of 13 public functions tested; no confidence in correctness for helpers like `formatMoney`, `retry`, `slugify`.

**Medium:**
- **Finding #6 (circular dependency)** — Fragile and will confuse new maintainers. Refactoring risks.
- **Finding #8 (no types)** — A library intended for reuse needs type hints to be usable safely.

### Priority Order

1. **Fix Finding #1 (chunk validation)** — Prevents crashes; 5 minutes.
2. **Fix Finding #2 (formatMoney)** — Core correctness; 10 minutes.
3. **Fix Findings #3 & #4 (parseDate validation)** — Prevents cascading bugs in isWeekend/pricing; 15 minutes.
4. **Resolve Finding #6 (circular dependency)** — Extract `isWeekend()` to separate module; 10 minutes.
5. **Expand test coverage (Finding #5)** — Add tests for all untested functions; 1-2 hours.
6. **Add JSDoc types (Finding #8)** — Document all public functions; 30 minutes.
7. **Consider Finding #7 (retry backoff)** — Document intent or add optional backoff for future use; 20 minutes.
8. **Address Finding #9 (silent fallback)** — Document or signal missing customers; 5 minutes.

---

## Coverage Gaps

**Not Examined:**
- Performance benchmarks — No profiling of time/memory for any function under load.
- Browser/Node.js compatibility — Assumed Node.js only (ES modules, Date.UTC); not tested in browser.
- Internationalization — Date parsing assumes Gregorian calendar; no localization tested.
- Concurrency — `retry()` is synchronous; concurrent call patterns not examined.
- Integration scenarios — How these functions interact in a real order-processing pipeline.
- Deployment/bundling — No test of minification, tree-shaking, or bundler compatibility.

**Tools Not Attempted:**
- `npm audit` — No dependencies to audit, so skipped.
- TypeScript compiler — No TypeScript in project; would require setup.
- ESLint/Prettier — No linter configured; would require installation and rules.

**Why These Gaps Don't Change the Assessment:**
- The critical and high findings are confirmed by direct testing; no tool would strengthen them.
- The library's size and scope (13 functions, <50 lines) means manual code review is sufficient.
- Type checking and linting would be nice-to-haves but don't uncover the correctness bugs already found.
