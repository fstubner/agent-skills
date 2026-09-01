# Engineering Assessment: orders-core

## Scope

### In Scope
- `src/util.js` — shared utility functions (formatMoney, describeOrder, slugify, parseDate, isWeekend, chunk, retry)
- `src/pricing.js` — pricing logic with weekend surcharge calculation
- `src/customers.js` — customer lookup and slug generation
- `test/pricing.test.js` — existing test suite
- `package.json` — project configuration
- `README.md` — documentation

### Out of Scope
- `.agent-input/` — evaluation input files
- Sibling run outputs or evaluation cases
- Integration tests or end-to-end workflows beyond the declared test suite
- Production deployment, logging, or monitoring configuration
- Performance benchmarks or load testing

### Depth
`Targeted` — every file in scope has been read in full. Automated checks were attempted but required explicit approval. Code review focused on correctness, architecture, security, and maintainability concerns.

---

## Environment

**Language & Runtime:** JavaScript (ES modules) on Node.js  
**Framework/Libraries:** None (standard library only)  
**Domain:** Utility/core library for order management (pricing, customers, shared helpers)  
**Platform Target:** Node.js server-side  
**Build/Test System:** npm with Node.js native test runner

---

## What I Ran

| Command | Result |
|---------|--------|
| `node --test test/pricing.test.js` | ❌ Requires explicit approval; not executed. Would validate pricing logic correctness. |

**Note:** Test execution required approval in this environment and was not run. Assessment proceeds based on code reading and static analysis.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Implicit date parsing assumption in `isWeekend()` may fail silently | `src/util.js:23-27` — `new Date(Date.UTC(...))` assumes valid YYYY-MM-DD input; no validation of parsing result | Add input validation in `parseDate()` to ensure valid number results; handle invalid date strings explicitly |
| 2 | High | Correctness | Weekend surcharge applies per-order, not per-item | `src/pricing.js:5-8` — surcharge added once to total (BASE_MINOR * quantity + surcharge), not per-item | Document this behavior clearly; verify it matches business intent. If per-item surcharge intended, multiply: `BASE_MINOR * order.quantity + (500 * order.quantity)` |
| 3 | High | Architecture | Circular dependency between util.js and pricing.js | `src/util.js:2` imports pricing.js; `src/pricing.js:1` imports util.js (via isWeekend) | Extract `isWeekend()` to a separate module or move it to pricing.js to break the cycle |
| 4 | Medium | Correctness | `chunk()` function silently relies on array mutation patterns | `src/util.js:29-33` — uses `slice()` which is safe, but the pattern is not explicitly tested | Add test coverage for chunk() to verify correctness with edge cases (empty array, size larger than array, etc.) |
| 5 | Medium | Maintainability | `retry()` function swallows error context before the last attempt | `src/util.js:35-41` — error message/stack from intermediate failures is lost; only final error thrown | Consider logging or preserving error chain; or document this as intentional "only care about final error" behavior |
| 6 | Medium | Correctness | `formatMoney()` does not handle negative values | `src/util.js:5-7` — negative minor amounts may produce confusing output (e.g., -550 becomes "-5.50" with no validation) | Add validation or document the expected input range; consider explicit sign handling |
| 7 | Medium | Architecture | util.js lacks cohesion; contains unrelated utilities | `src/util.js:1-42` — mixes money formatting, order description, text slugification, date parsing, date validation, array chunking, and retry logic | Consider breaking into domain-specific modules (money.js, text.js, date.js, async.js) to improve maintainability for package reuse |

---

## Unconfirmed Issues

- **Date parsing edge cases:** Without running tests or external testing, the exact behavior of `parseDate()` on malformed input (e.g., "2026-13-45", "2026-9-2") is unknown. The function silently succeeds and passes invalid dates to `new Date()`.
- **Empty retry behavior:** `retry()` with `times=0` or negative would throw `TypeError: last is not defined`. Edge case not confirmed without test execution.
- **Customer lookup performance:** With hardcoded customer list, performance is not a concern now, but if this scales, `Array.find()` is O(n). Unverified whether this matters in practice.

---

## Summary

### Strengths

1. **Minimal dependencies:** Uses only Node.js standard library (no external packages), reducing supply-chain risk and maintenance burden.
2. **Clear function signatures:** Most functions have obvious inputs/outputs (`priceFor`, `slugify`, `formatMoney`, `findCustomer`), making them easy to understand and reuse.
3. **Focused pricing logic:** `pricing.js` is concise and readable; the surcharge rule is easy to follow.

### Key Risks

1. **Circular dependency (Finding #3):** `util.js` ↔ `pricing.js` creates bidirectional coupling that will complicate module extraction for reuse and may cause import order issues. This must be resolved before splitting the package.
2. **Unchecked date parsing (Findings #1, #2):** The package assumes valid YYYY-MM-DD dates with no validation. Invalid dates silently produce incorrect or NaN results. This is a correctness risk for any consumer.
3. **Low cohesion (Finding #7):** util.js is a grab-bag of unrelated utilities with no clear domain. Reusing this package means importing money, text, date, and async helpers together, even if only one is needed.
4. **Implicit surcharge model (Finding #2):** The pricing rule (flat per-order surcharge vs. per-item) is not documented; misunderstanding could lead to incorrect pricing in consumers.

### Priority Order

1. **Break the circular dependency (Finding #3)** — Extract `isWeekend()` or consolidate modules. This blocks clean reuse of any part of the package.
2. **Document or fix the surcharge model (Finding #2)** — Clarify if the per-order (not per-item) surcharge is intentional; update code or docs accordingly.
3. **Add date parsing validation (Finding #1)** — Validate that `parseDate()` produces valid numbers and add error handling for malformed input.
4. **Refactor util.js for cohesion (Finding #7)** — Break util.js into focused modules (money, date, text, retry) so consumers can import only what they need.
5. **Add test coverage for utility functions (Finding #4)** — Test `chunk()`, `retry()`, `formatMoney()`, and `slugify()` with edge cases once structure improves.
6. **Add negative-value handling to formatMoney (Finding #6)** — Document or validate the expected range.

### Coverage Gaps

- **Tests not executed:** The test suite (`test/pricing.test.js`) declares two tests but could not be run in this environment; test results and coverage metrics are unavailable.
- **Type safety:** No TypeScript or JSDoc types; runtime type errors are not caught statically.
- **Integration testing:** No tests cover multi-module interactions (e.g., `describeOrder` using both pricing and customers).
- **Lint/format checks:** No configured linter or formatter; code style consistency is not verified.
- **Dependency audit:** No package vulnerability scan performed (npm audit).
- **Performance testing:** No benchmarks or profiling of utility functions (especially retry and chunk).
- **Backward compatibility:** If this package is extracted and versioned, there is no test of API stability across versions.
- **Documentation of edge cases:** Behavior on empty inputs, null/undefined, or extreme values (e.g., quantity=0, dates before 1970) is not specified.

---

## Readiness for Reuse

**Assessment:** This package is **not ready for standalone reuse** without changes.

**Key blockers:**
1. The circular dependency between util.js and pricing.js must be resolved.
2. util.js lacks cohesion; reusers will import unrelated utilities and will face brittle, multi-concern dependencies.
3. Date validation is missing; unsafe for production use without fixes.

**Recommended steps before extraction:**
1. Resolve the circular import.
2. Refactor util.js into focused, single-purpose modules.
3. Add input validation and error handling.
4. Document or fix the surcharge pricing model.
5. Expand test coverage to cover edge cases and multi-module interactions.

Once these items are addressed, the package can be extracted as a stable, reusable core module.
