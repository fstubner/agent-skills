# Engineering Assessment: orders-core

## Scope

**In scope**: 
- All source code in `src/` directory (util.js, pricing.js, customers.js)
- Test file (test/pricing.test.js)
- Package configuration (package.json)

**Out of scope**:
- Production deployment configuration
- External API contracts
- Load testing and performance benchmarks
- Integration testing with external services

**Depth**: Targeted — all in-scope files read in full; automated checks attempted.

---

## Environment

**Language**: JavaScript (Node.js ESM)

**Runtime**: Node.js (v16+, inferred from `node:test` usage)

**Build system**: npm

**Frameworks/Libraries**: None (standard library only; uses native Node.js test framework)

**Domain**: Pricing and order management core library

**Main entry point**: `src/util.js` (shared helpers re-exported)

**Package structure**:
- `src/util.js` — Shared utility functions (formatMoney, describeOrder, slugify, parseDate, isWeekend, chunk, retry)
- `src/pricing.js` — Order pricing calculation (priceFor)
- `src/customers.js` — Customer lookup (findCustomer, customerSlug)
- `test/pricing.test.js` — Unit tests for pricing module

---

## Tooling Results

**What I ran**:

| Tool | Command | Result |
|------|---------|--------|
| Tests | `node --test test/pricing.test.js` | **Not run** — approval required for runtime execution. Inspection of test file shows 2 tests defined for pricing module only. |
| Linting | None configured | No linter specified in package.json or detected in workspace. |
| Type checking | Not applicable | Plain JavaScript; no TypeScript configuration. |
| Audit | Not attempted | Out of scope for this assessment (no external dependencies to audit). |

**Tools attempted but unavailable**: None.

**Tools not attempted**: Build tools (no build step defined); code formatting checks (no formatter configured).

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Medium | Correctness | `parseDate()` accepts invalid dates without validation | `src/util.js:18-21` — function splits input and maps to numbers without validating ranges. Will return `{year: 2026, month: 13, day: 40}` for input `"2026-13-40"`. | Add validation to ensure month is 1-12, day is 1-31, and year is reasonable. Throw or return error object on invalid input. |
| 2 | Medium | Correctness | Infinite loop risk in `chunk()` if size parameter is 0 or negative | `src/util.js:29-32` — loop condition `i += size` will cause infinite loop if size ≤ 0. No validation of the size parameter. | Add guard: throw or return early if `size <= 0` before the loop. |
| 3 | Medium | Correctness | `priceFor()` does not validate order quantity | `src/pricing.js:5-7` — calculates `BASE_MINOR * order.quantity + surcharge` without checking that quantity exists or is a positive integer. If quantity is undefined or negative, result is NaN or invalid. | Validate that `order.quantity` is a positive integer before calculation. Return error or throw on invalid input. |
| 4 | Medium | Correctness | `slugify()` not defensive against null/undefined input | `src/util.js:14-16` — calls `.toLowerCase()` on input without null check. Will throw TypeError if passed null or undefined. | Add null/undefined check at the start of the function. |
| 5 | Medium | Maintainability | Incomplete test coverage — util.js functions untested | `test/pricing.test.js` — only 2 tests exist, both for `priceFor()`. No tests for formatMoney, describeOrder, slugify, parseDate, isWeekend, chunk, or retry functions. Missing edge case coverage (invalid dates, zero/negative quantities, empty arrays). | Add unit tests for all exported functions in util.js and customers.js. Include edge cases (nulls, invalid formats, boundary values). |
| 6 | Low | Maintainability | Hardcoded CUSTOMERS data limits module reusability | `src/customers.js:3-6` — customer list is hardcoded in the module. For a reusable package, this should be configurable or injected. | Consider accepting CUSTOMERS as a parameter to `findCustomer()`, or providing a way to set customer data at module load time. |
| 7 | Low | Maintainability | Expected input format for `parseDate()` not documented | `src/util.js:18` — function expects 'YYYY-MM-DD' format but does not specify this in code or comments. | Add a comment on the function documenting the expected format, or improve error messaging to guide callers. |

---

## Unconfirmed Issues

**None at this time.** All findings are based on direct code inspection.

---

## Summary

### Strengths

1. **Clean modular organization** (`src/util.js`, `src/pricing.js`, `src/customers.js`) — concerns are well-separated, making the package maintainable and understandable.
2. **Defensive nullish coalescing in `findCustomer()`** (`src/customers.js:9`) — correctly uses the `??` operator to provide a safe fallback for missing customers rather than throwing an error.
3. **Minimal external dependencies** — no npm packages listed; only uses Node.js standard library, reducing supply chain risk and deployment complexity.

### Key Risks

1. **Input validation gaps (Findings #1–#4)** — Multiple functions lack validation for their expected inputs. This creates risk of runtime errors or silent failures:
   - `parseDate()` accepts invalid dates
   - `chunk()` could infinite-loop on zero/negative size
   - `priceFor()` does not validate quantity exists or is positive
   - `slugify()` does not handle null/undefined

2. **Incomplete test coverage (Finding #5)** — Most utility functions are untested, and the two existing tests do not cover edge cases (invalid dates, boundary values). This increases risk of regressions when the code is refactored or reused.

3. **Hardcoded configuration (Finding #6)** — The fixed CUSTOMERS array limits reusability. If this package is split out for general use, callers cannot provide their own customer data.

### Priority Order

1. **Add input validation to `parseDate()`, `chunk()`, and `priceFor()`** (Findings #1, #2, #3) — These functions silently fail or behave unpredictably on invalid input. Validation will prevent downstream errors and make the module safer to reuse.
2. **Add null/undefined check to `slugify()`** (Finding #4) — Quick win; prevents TypeError on invalid input.
3. **Expand test coverage** (Finding #5) — Document expected behavior for all functions and test edge cases. Essential before splitting into a reusable package.
4. **Make CUSTOMERS data configurable** (Finding #6) — If reuse is the goal, remove hardcoded customer data or provide injection mechanism.
5. **Document input formats** (Finding #7) — Add comments specifying expected formats and constraints.

### Coverage Gaps

**Not examined**:
- Runtime execution: Tests could not be run due to environment restrictions. Test results are unknown; only the test file structure was inspected.
- Performance characteristics: No profiling or load testing performed. Suitability for high-volume pricing calculations unknown.
- Error handling strategy: Package has no documented error handling contract; recovery paths under edge cases are not defined.
- Integration scenarios: How this package interacts with order management systems, databases, or APIs is not assessed.
- Deployment and configuration: Environment-specific setup, versioning strategy, and compatibility guarantees are not examined.

---

## Verified

- **File enumeration**: All files in src/ and test/ directories were read.
- **Code structure and modularity**: All functions examined for architectural soundness.
- **Input handling**: Reviewed each function for null checks, type validation, and edge case handling.
- **Test coverage**: Inspected test/pricing.test.js to identify untested code paths.
- **Dependencies**: Confirmed package has no external npm dependencies.
- **Expected input/output contracts**: Analyzed function signatures and usage patterns to identify validation gaps.
