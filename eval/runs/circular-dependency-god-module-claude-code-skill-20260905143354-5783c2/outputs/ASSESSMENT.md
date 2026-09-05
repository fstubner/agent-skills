# Engineering Assessment: orders-core

## Scope

**In scope:**
- `src/util.js` — shared utility functions (6 exported functions)
- `src/pricing.js` — order pricing logic (1 exported function)
- `src/customers.js` — customer lookup (2 exported functions)
- `test/pricing.test.js` — existing test suite
- `package.json` — package configuration
- `README.md` — documentation

**Out of scope:**
- Runtime behavior in production environments
- Performance profiling or load testing
- Integration with external systems (if any)
- Evaluation cases, graders, or test fixtures outside the provided workspace

**Depth:** Targeted — all in-scope files read in full; automated checks run.

---

## Environment

**Language & Runtime:** JavaScript (ES modules), Node.js 18+

**Framework & Domain:** Utility library for order pricing and customer management; shared helpers package

**Build System:** npm; entry point is `src/util.js`

**Automated Checks Available:**
- Unit tests: `npm test` (using Node.js built-in test runner)
- No lint, type check, or build commands configured

---

## Tooling Results

### What I ran

| Command | Result |
|---------|--------|
| `npm test` | **PASS** — 2 tests executed, 2 passed, 0 failed; duration 108.9ms |
| `npm run` | Lists available scripts; only `test` is defined |

### Tools run successfully
- `npm test`: Both tests passed (weekday and weekend pricing surcharge tests)

### Tools not available or not attempted
- **Linting**: No ESLint or similar configured; `npm run lint` would fail
- **Type checking**: No TypeScript or JSDoc checker configured
- **Dependency audit**: `npm audit` not configured in scripts (could be run but not a declared script)
- **Format checking**: No Prettier or code formatter configured

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | `retry()` function throws `undefined` on invalid input | `src/util.js:35–41` — If `times` ≤ 0, loop never runs, `last` remains undefined, `throw last` (line 40) throws undefined instead of an Error. No bounds checking. | Add input validation: `if (times <= 0) throw new Error('retry: times must be > 0');` or return early with `throw new Error('all retries failed')` and assign a default error. |
| 2 | High | Reliability | Severe test coverage gap on reusable utility functions | `test/pricing.test.js` — Only 2 tests; 6 untested functions in `util.js` (`formatMoney`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`) and 2 untested functions in `customers.js`. Untested functions (e.g., `retry`) contain latent bugs. | Add tests for all exported functions, prioritizing `retry`, `parseDate`, and `formatMoney` which have edge-case bugs. Target >80% line coverage before package extraction. |
| 3 | Medium | Architecture | Circular dependency between `util.js` and `pricing.js` | `src/util.js:2` imports `priceFor` from `pricing.js`; `src/pricing.js:1` imports `isWeekend` from `util.js`. Works in practice (isWeekend is lazy), but violates layering and complicates refactoring. | Extract `isWeekend` to a separate module (e.g., `src/date-utils.js`) or move pricing logic to avoid the cycle. |
| 4 | Medium | Correctness | `formatMoney()` produces invalid output for negative values | `src/util.js:6` — `Math.floor(minor / 100)` and `minor % 100` on negative input (e.g., -50) yields `-1.-50` (JavaScript's modulo can be negative). No domain validation. | Add input validation: `if (minor < 0) throw new Error('formatMoney: minor must be non-negative');` or document that only non-negative values are accepted. |
| 5 | Medium | Correctness | `parseDate()` does not validate input format or detect invalid dates | `src/util.js:18–21` — No check that `value.split('-')` yields exactly 3 parts or that they are valid date components. `new Date(Date.UTC(NaN, NaN, NaN))` silently succeeds, producing an invalid date. Called by `isWeekend()`, used in `priceFor()`. | Validate format before parsing: `if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(...)` and check `isNaN(dow)` after getUTCDay(). |
| 6 | Medium | Input Validation | `priceFor()` and other functions assume valid object structure without validation | `src/pricing.js:5–8` — No check that `order.date` and `order.quantity` exist or are the expected type. Missing fields silently produce NaN or wrong results. `findCustomer()` (`src/customers.js:9`) assumes `id` parameter exists. | Document required object shapes or add runtime validation (e.g., `if (typeof order?.date !== 'string') throw new Error(...)`). |

---

## Unconfirmed Issues

None identified. All issues in the findings table have concrete evidence in the code.

---

## Summary

### Strengths

1. **Clear separation of concerns** — Pricing, customers, and utilities are logically split across three modules with focused responsibilities (evidence: clean, single-purpose exports in each file).
2. **Passing test suite** — The two pricing tests execute correctly and cover the core happy-path for surcharge calculation (evidence: `npm test` output shows 2 pass, 0 fail).

### Key Risks

**Finding #1 (High — Correctness):** The `retry()` function will crash with `undefined` if called with invalid input (`times ≤ 0`). Since this is intended as a reusable helper, incorrect usage is a realistic risk.

**Finding #2 (High — Reliability):** Most utility functions lack tests. Several untested functions contain bugs (e.g., `retry`, `formatMoney`, `parseDate`). Before extracting as a reusable package, untested code with latent bugs is a significant quality risk.

**Finding #3 (Medium — Architecture):** The circular dependency between `util.js` and `pricing.js` is not currently breaking but complicates future refactoring and violates module layering principles. Breaking the cycle now is better than inheriting it.

**Finding #4 & #5 (Medium — Correctness):** Input validation is missing throughout. `formatMoney`, `parseDate`, and `priceFor` will silently produce wrong results or crash on invalid input. For a reusable package, this is a quality concern.

### Priority Order

1. **Add input validation to `formatMoney`, `parseDate`, and `priceFor`** (Medium, but foundation for safety) — Quick to add and prevents silent failures.
2. **Fix and test the `retry()` function** (High, fix + test) — Add bounds checking and a default error; write tests for edge cases (`times=0`, `times=1`, success on Nth attempt, permanent failure).
3. **Break the circular dependency** between `util.js` and `pricing.js` (Medium) — Extract date utilities to a separate module or consolidate strategically.
4. **Expand test coverage** (High, ongoing) — Add tests for `formatMoney`, `slugify`, `chunk`, `parseDate`, `isWeekend`, and all `customers.js` functions. Target 80%+ coverage.
5. **Document or enforce object shapes** (Medium) — Add JSDoc or runtime validation for `priceFor(order)` and `findCustomer(id)`.

### Coverage Gaps

**Not examined:**
- Runtime behavior under production load or edge conditions (e.g., very large order quantities, dates at epoch boundaries).
- Integration or end-to-end tests involving actual customers and orders.
- Internationalization, locale-specific formatting, or currency handling beyond minor units.
- Performance characteristics of `chunk()` and `retry()` on large inputs or high-frequency retries.
- Deployment or versioning strategy for the extracted package.
- Security audit of input vectors (assume untrusted external callers).

**Tools not run:**
- Linting or code style checks (no ESLint configured).
- Type checking (no TypeScript or JSDoc type validation).
- Dependency audit (no audit command in scripts; could reveal vulnerabilities).
- Format checking (no Prettier or formatter configured).

---

## Conclusion

The package is **functionally complete for its current scope** but **not yet production-ready for reuse**. The core pricing and customer logic works as evidenced by passing tests. However, before extraction:

- **Critical fixes required:** Input validation on utility functions and the `retry()` edge case.
- **Test coverage required:** Most exported functions are untested, including ones with bugs.
- **Architecture cleanup:** Resolve the circular dependency between `util.js` and `pricing.js`.

These are all addressable with moderate effort and should be completed before the package is released as a dependency.
