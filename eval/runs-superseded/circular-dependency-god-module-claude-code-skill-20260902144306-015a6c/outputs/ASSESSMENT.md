# Engineering Assessment: orders-core

## Scope

**In scope:**
- `src/util.js` — shared helpers module (main entry point)
- `src/customers.js` — customer lookup module
- `src/pricing.js` — order pricing logic
- `test/pricing.test.js` — test suite
- `package.json` — package manifest
- `README.md` — documentation

**Out of scope:**
- `.agent-input/` — assessment workflow files
- Build system beyond what's declared in package.json
- Runtime environment or deployment configuration
- Integration with external systems (only internal module behavior examined)

**Depth:** Targeted — all in-scope source files read in full, imports traced, test file examined.

---

## Environment

**Language and Runtime:**
- JavaScript (ES modules)
- Node.js (test uses `node:test` and `node:assert`, available in Node 18+)

**Frameworks and Libraries:**
- None; uses only Node.js built-in modules

**Domain:**
- Order processing library (pricing, customer lookup, utility functions)

**Build and Tooling:**
- Test runner: Node.js built-in test framework (`node --test`)
- Package type: ES modules (`"type": "module"` in package.json)
- Main entry: `src/util.js`

---

## What I Ran

**Attempted:**
- Test suite: `node --test test/pricing.test.js`
  - Status: Cannot execute in this environment (requires approval for runtime execution)
  - Impact: Cannot verify test outcomes directly; analysis relies on code review and test source inspection

**Not attempted:**
- Linting: No linter configured in package.json or workspace
- Type checking: No TypeScript or JSDoc type checking configured
- Format checking: No formatter configured (e.g., Prettier)
- Dependency audit: No `npm audit` or similar (no lock file present to audit)
- Build: No build step defined; module loads directly as ES imports

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Architecture | Circular module dependencies | `util.js` imports `customers.js` (line 3), which imports `util.js` (line 1); `util.js` also imports `pricing.js` (line 2), which imports `util.js` (line 1) | Break cycles by extracting shared functions (e.g., `isWeekend`, `slugify`) into separate files or invert import direction |
| 2 | High | Maintainability | Monolithic util.js contains unrelated concerns | `util.js` combines money formatting (lines 5–7), order description (lines 9–12), text slugification (lines 14–16), date parsing (lines 18–21), weekend checking (lines 23–27), array chunking (lines 29–33), and retry logic (lines 35–41) — 7 distinct concerns | Refactor into feature-focused modules: `money.js`, `dates.js`, `strings.js`, `retry.js`, or organize by domain (pricing, customers, utilities) |
| 3 | High | Testing | Insufficient test coverage | Only `test/pricing.test.js` exists; tests only `priceFor()`. No tests for: `formatMoney`, `describeOrder`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`, `findCustomer`, or `customerSlug` | Add tests for untested functions, prioritizing critical paths: `describeOrder` (public API), `parseDate` (used by `isWeekend`), `retry` (control flow), `formatMoney` (output formatting) |
| 4 | Medium | Correctness | `parseDate()` lacks input validation | Function splits input on '-' and maps to numbers (line 19) without checking format, valid date range, or parsing errors. Examples: `"2026-13-32"` parses silently to `{year: 2026, month: 13, day: 32}`, which later produces undefined behavior in `isWeekend()` | Add validation: require three parts, check month 1–12, check day 1–31 (or use `Date.UTC()` and re-check if day is valid) |
| 5 | Medium | Correctness | `retry()` function has edge-case behavior | If `times` is 0 or negative, the function throws `undefined` (line 40 throws `last` which is uninitialized). No error message or retry count logging | Guard against invalid inputs: throw `new Error('retry: times must be > 0')` if times <= 0; consider logging retry attempts |
| 6 | Medium | Reliability | `isWeekend()` has brittle date parsing | Function depends on `parseDate()` to extract year/month/day; if `parseDate()` silently accepts malformed dates (issue #4), `isWeekend()` will produce incorrect results without error | Fix `parseDate()` validation (issue #4); add error handling in `isWeekend()` to detect invalid dates |
| 7 | Medium | Maintainability | Missing JSDoc documentation | No function has JSDoc comments; parameters, return types, and expected formats are undocumented. Example: `priceFor()` expects `order.quantity` and `order.date` format, but this is invisible to callers | Add JSDoc to all exported functions with `@param`, `@returns`, and `@example` tags. Minimum: document parameter types and date format (e.g., `YYYY-MM-DD`) |
| 8 | Low | Maintainability | `describeOrder()` does not validate input | Function assumes `order.customerId` exists and is a valid ID; no checks for null/undefined | Add null/undefined check before calling `findCustomer()`; consider throwing or returning a default error message |
| 9 | Low | Maintainability | Hardcoded customer list limits modularity | `CUSTOMERS` in `customers.js` is a static array (lines 3–6); module cannot be reused for different customer sets | Document this as a limitation; if reusability is needed, accept customers as a parameter or configuration |

---

## Unconfirmed Issues

**Circular dependency runtime behavior:** The circular imports (util → customers → util and util → pricing → util) are present in the source. Whether they cause runtime errors depends on the order of module initialization and whether any cycles reference hoisted exports (e.g., top-level class declarations). Since only functions are exported and imported after definition, these are likely safe at runtime but represent a structural risk during refactoring.

---

## Summary

### Strengths

1. **Clear module separation by domain:** Despite the circular imports, the code is organized by concern (pricing, customers, utilities), making the intent readable.
2. **Focused pricing logic:** The `pricing.js` module is compact and testable, with a clear calculation formula that is well-suited for the existing test cases.
3. **Test-first execution:** The test suite demonstrates basic testing infrastructure and serves as specification (weekday vs. weekend surcharge).
4. **No external dependencies:** The package uses only Node.js built-ins, minimizing supply-chain risk and installation overhead.

### Key Risks

- **Architectural fragility:** Circular dependencies (issues #1) and monolithic util.js (issue #2) make refactoring and reuse difficult. Any change to one module could ripple unexpectedly through others.
- **Data validation gaps:** The `parseDate()` function (issue #4) silently accepts invalid dates, which propagates silently through `isWeekend()` and subsequently into pricing logic (issue #6). This is a potential correctness issue.
- **Low test coverage:** Only 1 of 9 exported functions is tested (issue #3). Untested functions like `retry()` and `chunk()` are exposed for reuse but unverified.
- **Documentation deficit:** No function documentation (issue #7) makes the API contract unclear, especially for date format expectations and error behavior.

### Priority Order

1. **Refactor circular dependencies** (issue #1) — Required before safe reuse. Extract `isWeekend` and `slugify` into separate modules to break cycles. Estimate: 1–2 hours. Impact: Unblocks confident package extraction.
2. **Add input validation to `parseDate()`** (issue #4) — Fix correctness risk in date parsing. Ensure valid month/day ranges. Estimate: 30 minutes. Impact: Prevents silent failures in `isWeekend()` and downstream pricing.
3. **Add JSDoc to all exported functions** (issue #7) — Document parameter types and date format expectations. Estimate: 45 minutes. Impact: Unblocks safe reuse outside this codebase.
4. **Expand test coverage** (issue #3) — Add tests for `describeOrder`, `parseDate`, `retry`, and `formatMoney`. Focus on edge cases in `parseDate` (invalid dates) and `retry` (zero attempts). Estimate: 1–1.5 hours. Impact: Confidence before extraction.
5. **Refactor util.js** (issue #2) — Split into focused modules (e.g., `formatting.js`, `dates.js`, `strings.js`) after circular dependencies are fixed. Estimate: 2–3 hours. Impact: Easier to understand and maintain.
6. **Guard `retry()` against invalid inputs** (issue #5) — Throw error if `times <= 0`. Estimate: 15 minutes. Impact: Prevents subtle bugs in callers.

### Coverage Gaps

- **Automated checks not run:** No linter, type checker, or formatter is configured. ESLint (with `node` environment) and a formatter like Prettier would likely surface style issues.
- **Runtime test execution:** Test suite exists but could not be executed in the assessment environment; analysis is based on test source code only. Actual test pass/fail status is unknown.
- **Customer data validation:** No tests verify that `findCustomer()` correctly handles unknown IDs or that the fallback `{ id, name: 'Unknown' }` is correct behavior.
- **Integration scenarios:** No tests of `describeOrder()`, which ties together customer lookup and pricing. This is a key public function that should be tested.
- **Edge cases for date/weekend logic:** No tests for boundary conditions (e.g., December 31 → January 1 transitions, leap years, invalid dates).
- **Error paths:** No tests for `retry()` behavior under error conditions, or for `parseDate()` with malformed input.
- **Performance:** No analysis of algorithmic complexity (e.g., `chunk()` and `retry()` are O(n), acceptable for typical usage, but untested).

---

## Conclusion

**orders-core** is a functional but structurally fragile module suitable for extraction with **three conditions:**

1. **Fix circular dependencies before extracting** — The current import graph will become a liability in a separate package. Break cycles by extracting date/string utilities.
2. **Strengthen validation and tests** — Add input validation to `parseDate()` and expand test coverage to cover integration paths (`describeOrder`) and edge cases.
3. **Document the API** — JSDoc comments are essential before reuse; the date format and error behavior are currently implicit.

Once these are addressed, the module is well-positioned for reuse. The concerns are structural (refactoring) and defensive (validation/tests), not fundamental logic errors.
