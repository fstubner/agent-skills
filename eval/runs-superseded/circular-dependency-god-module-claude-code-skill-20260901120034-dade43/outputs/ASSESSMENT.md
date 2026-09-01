# Engineering Assessment: orders-core

## Scope

**In scope:**
- `src/` directory (all three modules: util.js, pricing.js, customers.js)
- `test/` directory (pricing.test.js)
- `package.json` and project configuration
- Codebase readability, correctness, and reusability concerns

**Out of scope:**
- Evaluation cases, graders, expected answers, or sibling run outputs
- External integration testing or production metrics
- Runtime performance profiling or load testing

**Depth:** Targeted — every file in scope has been read in full. No external build/lint/type-checking tools were available to run.

---

## Environment

**Language and runtime:** JavaScript (ES modules), Node.js 18+

**Frameworks and libraries:** None (uses only Node.js built-in `assert` and `test` modules)

**Domain:** Order management utilities — pricing, customer lookup, and shared helpers

**Build system:** npm

**Test framework:** Node.js built-in `test` module

---

## What I Ran

No automated checks were executed because:
- No linter configuration (eslint/prettier not in package.json)
- No type checker (not TypeScript)
- No additional test commands beyond the declared `npm test`
- The test command exists but requires explicit shell approval to execute

The package.json declares only one script: `"test": "node --test test/pricing.test.js"`.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | `parseDate()` silently produces NaN on invalid input, propagating to pricing calculations | `src/util.js:18-21` — `parseDate('invalid')` returns `{year: NaN, month: NaN, day: NaN}`. When passed to `isWeekend()`, `new Date(Date.UTC(NaN, NaN, NaN))` creates an epoch date (1970-01-01), yielding incorrect day-of-week and wrong surcharge calculations in `priceFor()`. | Validate date format in `parseDate()` before parsing. Throw an error or return a sentinel value (not NaN) for malformed dates. Update `isWeekend()` to validate the parse result. |
| 2 | Medium | Correctness | Incomplete input validation in core pricing function | `src/pricing.js:5-8` — `priceFor()` does not validate that `order` contains required fields (`date`, `quantity`). Undefined/null fields will produce NaN or errors in downstream calculations. | Add validation: check that `order` is an object with `date` (string) and `quantity` (number) fields, or throw a descriptive error. |
| 3 | Medium | Reliability | `describeOrder()` has no error handling for missing customer or pricing failures | `src/util.js:9-12` — Calls `findCustomer()` and `priceFor()` without try-catch. If `priceFor()` throws (e.g., malformed order), the error propagates unhandled. | Wrap calls in error handling or validate inputs before calling downstream functions. Document expected behavior when customer is not found or order is invalid. |
| 4 | Medium | Maintainability | `formatMoney()` has no input validation; silently produces unexpected output for non-numeric input | `src/util.js:5-7` — `formatMoney(null)` produces "0.null", `formatMoney('abc')` produces "NaN.NaN". Callers cannot detect invalid input. | Add type/range validation at the start of `formatMoney()`. Throw a descriptive error if `minor` is not a non-negative integer. |
| 5 | Medium | Testing | Test coverage is incomplete; 5 of 7 public functions are untested | `test/pricing.test.js` — Only `priceFor()` is tested. Functions `formatMoney()`, `describeOrder()`, `slugify()`, `chunk()`, `retry()`, `parseDate()`, and `isWeekend()` have no test coverage. Tests cover only the happy path; no error cases are tested. | Add test cases for all public functions, including: (a) valid inputs and expected outputs, (b) edge cases (boundary values, empty strings, empty arrays), (c) invalid inputs (null, undefined, wrong types, malformed dates). |
| 6 | Medium | Architecture | Module coupling reduces reusability; util.js imports from pricing.js and customers.js, creating implicit dependencies | `src/util.js:1-2` — `util.js` is exported as the main entry point (`package.json:4`) but imports from `pricing.js` and `customers.js`. A consumer of `util.js` must also have those modules available. For a reusable package, the main module should not have specific domain dependencies. | Reorganize: move domain-specific helpers (e.g., `describeOrder()`) to a separate module or remove them from `util.js`. Keep only truly generic helpers in the main export. Document which functions depend on other modules. |
| 7 | Medium | Maintainability | No documentation of public API or function behavior | No JSDoc comments or function documentation. README provides no details on function signatures, parameters, or error behavior. For a package intended for reuse, this is a gap. | Add JSDoc comments to all exported functions with: (a) parameter types and descriptions, (b) return type and value, (c) error conditions and exceptions, (d) example usage for complex functions. Update README with a usage section. |
| 8 | Low | Maintainability | Missing documentation for `retry()` function | `src/util.js:35-41` — Function retries by swallowing exceptions and retrying the function call, but its intended use case and behavior on success vs. final failure are not documented. | Add JSDoc with example: when to use (resilient operations), what it does on success (returns first successful result), and on failure (throws the last error). |

---

## Unconfirmed Issues

None identified that cannot be confirmed through code inspection.

---

## Summary

### Strengths

1. **Focused scope** — The package has a clear, narrow purpose (pricing, customers, utilities) with limited external dependencies. The small codebase makes it easy to understand and modify.

2. **Defensive null handling in findCustomer()** — `src/customers.js:8-10` returns a sensible default (`{ id, name: 'Unknown' }`) for missing customers rather than throwing, improving robustness in call sites.

3. **Simple, readable utility functions** — `chunk()`, `slugify()`, and `retry()` are well-written, easy to understand, and serve clear purposes.

### Key Risks

The package is **not ready for reuse as-is**. The primary risks are:

1. **Correctness risk (Finding #1):** Invalid dates silently corrupt pricing calculations. A consumer could unknowingly charge incorrect amounts, causing data integrity and financial impact.

2. **Validation gaps (Findings #2, #4):** Core business logic functions assume valid input. When called with malformed data (common at system boundaries), they produce undefined behavior instead of failing fast with clear errors.

3. **Incomplete test coverage (Finding #5):** Splitting a package with 71% untested code creates maintenance risk for the consuming team and makes it hard to catch regressions.

4. **Architectural coupling (Finding #6):** The main module imports domain-specific modules, coupling consumers to internal organization. A reusable package should separate generic utilities from domain logic.

### Priority Order

1. **Add input validation to `parseDate()` and `priceFor()`** — These are critical paths. Validate or fail fast. (High impact, medium effort)

2. **Add error handling and validation to `formatMoney()` and `describeOrder()`** — Prevent silent failures. (Medium effort)

3. **Refactor module structure** — Move `describeOrder()` out of the generic utils, or clearly document that `util.js` requires `pricing.js` and `customers.js` to be available. (Medium-to-high effort, depends on design decision)

4. **Write comprehensive tests** — Add test coverage for all functions with happy path and error cases. (High effort, high value)

5. **Add JSDoc documentation** — Document function contracts for consumers. (Low effort, high value for reuse)

### Coverage Gaps

- **No automated linting or type checking** — No linter or TypeScript available to check for additional style/correctness issues.
- **No performance testing** — No measurements of the utility functions under load (e.g., `chunk()` on large arrays, `retry()` under high contention).
- **No production usage data** — Cannot verify whether the identified issues manifest in real usage or if the assumptions about typical input are correct.
- **Integration tests** — No tests of how these utilities integrate when called together (e.g., `describeOrder()` → `priceFor()` → `isWeekend()` chain).
- **Error recovery paths** — Error handling strategy across the codebase is inconsistent; cannot verify intended error propagation or user-facing messaging.

---

## Verification Summary

**Verified through code inspection:**
- All three source files read in full
- All test files examined
- Dependencies, imports, and module structure mapped
- Input/output behavior of 8 public functions analyzed
- Edge case handling for date parsing, money formatting, and pricing logic confirmed as inadequate
- Test coverage gaps identified (5 of 7 functions untested)
- Module coupling assessed and documented
