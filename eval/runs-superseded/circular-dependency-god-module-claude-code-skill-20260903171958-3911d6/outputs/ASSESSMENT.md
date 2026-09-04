# Engineering Assessment: orders-core

## Scope

**In scope:**
- `package.json` — project metadata and build/test configuration
- `src/util.js` — shared utilities (42 lines, 7 exported functions)
- `src/pricing.js` — pricing logic (8 lines, 1 exported function)
- `src/customers.js` — customer lookup (14 lines, 2 exported functions)
- `test/pricing.test.js` — test suite (12 lines, 2 tests)
- README.md — project documentation

**Out of scope:**
- Evaluation cases, graders, or expected answers in sibling runs
- Production deployment or runtime environment
- Integration with external systems beyond what is imported

**Depth:** Targeted — every in-scope file read in full, all code reviewed systematically, available automated checks attempted.

---

## Environment

**Language and runtime:** JavaScript (ES modules), Node.js
**Frameworks/libraries:** Node.js built-in modules only (`node:test`, `node:assert`)
**Domain:** Pricing and order management utilities
**Build system:** npm (package.json scripts)
**Entry point:** `src/util.js`

---

## Tooling Results

### What I ran:

**Command:** `node --test test/pricing.test.js`  
**Status:** Not executed — requires approval.

**Reason:** Test command needs user permission to run. No build step, linting, type-checking, or audit tools are configured in package.json.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | Invalid date strings silently bypass surcharge logic | `src/util.js:18–20` — `parseDate()` does not validate input. `"invalid"` produces `{ year: NaN, month: NaN, day: NaN }`. Passed to `isWeekend()` (line 24), it creates an invalid `Date` object; `getUTCDay()` returns `NaN`; comparison `NaN === 0 || NaN === 6` is always false. Result: any malformed date is treated as non-weekend, bypassing the weekend surcharge in `priceFor()` (src/pricing.js:6). | Add input validation to `parseDate()`. Check that split parts are valid numbers and that the resulting date is in valid range. Alternatively, use `Date.parse()` or throw an error on invalid input. |
| 2 | High | Reliability | `retry()` throws `undefined` when invoked with zero retries | `src/util.js:35–40` — If `times` is 0, the for-loop does not execute; `last` remains undefined; `throw last` throws `undefined`. This violates error-propagation guarantees. Also, the parameter name `times` is ambiguous: does it mean total attempts or number of retries? | Clarify intent: if `times` is the total number of attempts, validate that `times >= 1`. If it is the number of retries, initialize attempts to 1 and loop `times` times. Always ensure `last` is initialized to a meaningful error value. |
| 3 | Medium | Correctness | `formatMoney()` produces unexpected output for negative amounts | `src/util.js:5–6` — `Math.floor(minor / 100)` of a negative number rounds down (towards negative infinity), not towards zero. E.g., `formatMoney(-150)` produces `"-2.50"` instead of `"-1.50"`. Padding logic does not account for negative remainders. | Decide whether negative amounts are valid in this domain. If yes, use `Math.trunc()` or `Math.sign()` to preserve intended rounding. Document the expected behavior. If no, add validation to reject negative amounts. |
| 4 | Medium | Reliability | Test coverage is incomplete | `test/pricing.test.js` contains 2 tests covering only `priceFor()`. No tests exist for 6 other exported functions: `formatMoney`, `describeOrder`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`, `findCustomer`, `customerSlug`. This leaves maintainability and correctness of these functions unverified. | Write tests for high-risk or frequently-used functions. Priority: `parseDate` (input validation), `retry` (error handling), `chunk` (boundary conditions), `describeOrder` (integration). |
| 5 | Medium | Correctness | `priceFor()` does not validate `order` object structure | `src/pricing.js:7` — Assumes `order.quantity` exists and is a number. Missing or invalid `quantity` results in `NaN * 2500 + surcharge`, producing `NaN` and propagating through `describeOrder()`. No validation or error thrown. | Add a guard clause in `priceFor()` to validate `order` and `order.quantity`. Either throw a descriptive error or document the required contract in JSDoc. |
| 6 | Medium | Maintainability | `util.js` mixes unrelated concerns with unclear reuse intent | `src/util.js` exports 7 functions: formatting, date parsing, chunking, retry logic, slugification, order description. This catch-all coupling makes it hard to use selectively in a split-out package. Functions like `chunk()` and `retry()` are generic but bundled with domain-specific logic. | Before splitting, separate concerns: move generic utilities (`chunk`, `retry`, `formatMoney`, `slugify`) into a `src/generic.js` or similar. Keep domain-specific functions (`priceFor`, `describeOrder`, `parseDate`, `isWeekend`) separate. This reduces coupling and improves reusability. |
| 7 | Low | Reliability | `findCustomer()` silently falls back to "Unknown" for missing customers | `src/customers.js:9` — Returns `{ id, name: 'Unknown' }` for unknown customer IDs. While graceful, this masks data issues at call sites and may produce confusing order descriptions. | If unknown customers should error, throw. If fallback is intentional, document it prominently and consider returning a flag indicating the fallback (e.g., `{ id, name: 'Unknown', isUnknown: true }`). |
| 8 | Low | Performance | `findCustomer()` uses linear search; not scalable | `src/customers.js:9` — `.find()` is O(n) on the CUSTOMERS array. For 2 items this is negligible, but if the list grows, consider an object map. | If `src/customers.js` is to be reused, provide a note about scalability or convert CUSTOMERS to a Map/object keyed by ID for O(1) lookup. Not urgent for current scale. |

---

## Unconfirmed Issues

None. All findings above are confirmed by direct code inspection.

---

## Summary

### Strengths

1. **Minimal dependencies and clear structure:** The package uses only Node.js built-in modules and organizes code into three focused files (pricing, customers, util). No external dependencies means low maintenance burden and broad compatibility.
2. **Graceful fallbacks in customer lookup:** `findCustomer()` returns a "Unknown" fallback (src/customers.js:9) rather than crashing, preventing cascading failures. This is appropriate defensive design for a reusable utility.
3. **Focused core logic:** `pricing.js` is compact and has a clear responsibility, making it easy to understand and verify.

### Key Risks

**Critical-to-High risks:**
1. **Invalid dates bypass pricing surcharges** (Finding #1) — The most serious issue. Malformed date strings are silently treated as non-weekends, potentially losing revenue. This affects the core pricing logic.
2. **Undefined error propagation in `retry()`** (Finding #2) — Error handling is broken for edge cases, reducing reliability of retry logic.

**Medium risks:**
3. **Weak input validation** (Findings #3, #5) — `formatMoney()` and `priceFor()` do not handle edge cases (negative amounts, missing fields). These are catchable with validation.
4. **Incomplete test coverage** (Finding #4) — 6 of 9 functions lack tests, leaving correctness unverified before split-out.
5. **Utility coat-tail coupling** (Finding #6) — Generic utilities bundled with domain logic complicates selective reuse.

### Priority Order

1. **Fix date validation in `parseDate()`** (Finding #1) — Highest impact: prevents silent pricing errors. Quick fix with high payoff.
2. **Add validation to `priceFor(order.quantity)` and `formatMoney()`** (Findings #5, #3) — Prevent NaN propagation. Medium effort, blocks reliable split-out.
3. **Fix `retry()` edge case and clarify intent** (Finding #2) — Improves reliability of error handling. Low effort.
4. **Write tests for untested functions** (Finding #4) — Especially `parseDate`, `retry`, `chunk`, `describeOrder`. Blocks confidence in reuse. Medium effort.
5. **Refactor `util.js` to separate generic from domain utilities** (Finding #6) — Before splitting, group related functions. This clarifies which parts are truly reusable and improves usability downstream.
6. **Reconsider `findCustomer()` fallback behavior** (Finding #7) — Document intent or add a flag to indicate unknown customers. Low priority; current behavior is reasonable.

### Coverage Gaps

**Not examined:**
- Automated testing (test command was not executed; no test runner output).
- Linting or style checks (no linter configured in package.json).
- Type checking or static analysis (JavaScript, no TypeScript or JSDoc type annotations).
- Performance benchmarks or load testing.
- Production usage patterns or deployment environment.
- Behavior under concurrent calls (no async code, so not applicable).
- Integration with external order or customer systems.

**Why this matters:** Without running tests, linting, or type-checking, correctness claims rest only on code inspection. Automated checks would likely catch some of the input-validation gaps (Findings #1, #5) if applied. Before split-out, this package should pass its own test suite and define lint/format rules.

---

## What I verified

- All 6 source files examined in full
- Function signatures, calls, and data flow analyzed
- Test coverage quantified (2 of ~9 functions)
- Input validation, error handling, and edge cases inspected
- Dependency structure and coupling reviewed
- Scalability and performance assumptions noted
