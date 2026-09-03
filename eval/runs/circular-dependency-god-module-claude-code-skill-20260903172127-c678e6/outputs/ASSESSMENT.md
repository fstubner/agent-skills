# Engineering Assessment: orders-core

## Scope

**In scope:**
- Source files: `src/util.js`, `src/pricing.js`, `src/customers.js`
- Test files: `test/pricing.test.js`
- Configuration: `package.json`

**Out of scope:**
- Assessment tooling configuration in `.agent-input/`

**Depth: Targeted**
All files in scope have been read in full. No exploratory searches or partial reads.

---

## Environment

**Language & Runtime:** JavaScript (ES modules), Node.js
**Frameworks:** None (vanilla Node.js)
**Domain:** Business logic package for orders, pricing calculations, and customer management
**Platform targets:** Server-side (Node.js)
**Build system:** npm
**Package type:** ES module with CommonJS interop support

---

## Tooling Results

### What I ran

| Command | Result |
|---------|--------|
| `npm test` | Could not run (requires approval in execution environment). Test entry point: `node --test test/pricing.test.js` |

### Tools not available or not run

- **Linting tools** (eslint): Not configured in package.json; would check code style and potential bugs.
- **Type checking** (TypeScript, JSDoc): Not configured; would catch type mismatches.
- **Format checking** (prettier): Not configured; would enforce consistent formatting.
- **Dependency audit** (npm audit): Not attempted; would identify outdated or vulnerable dependencies.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | Unvalidated date input in pricing logic | `src/util.js:19` — `parseDate()` does not validate format; invalid date strings (missing dashes, wrong format) will produce `{year: NaN, month: NaN, day: NaN}`. `src/util.js:25` — `isWeekend()` calls `parseDate()` without validation; malformed `order.date` will fail silently, returning `false` (no surcharge applied). `src/pricing.js:6` — `priceFor()` passes `order.date` directly to `isWeekend()` without format verification. | Add input validation to `parseDate()`: reject dates not matching `YYYY-MM-DD` format, or add JSDoc specifying required format and document the error behavior when invalid input is passed. Alternatively, add a pre-call check in `priceFor()` to validate the date format before pricing. |
| 2 | High | Architecture | Circular dependency between modules | `src/util.js:2` imports `priceFor` from `src/pricing.js`; `src/pricing.js:1` imports `isWeekend` from `src/util.js`. Circular dependency chain: `util.js` → `pricing.js` → `util.js`. This creates a fragile initialization order dependency and complicates testing and reuse. | Move the `isWeekend()` function into `pricing.js`, or create a new `date-utils.js` module for date-related utilities that neither `util.js` nor `pricing.js` depend on. This breaks the cycle and improves module cohesion. |
| 3 | Medium | Maintainability | Incomplete test coverage | `test/pricing.test.js` contains only 2 test cases for `priceFor()`. No tests exist for: `util.js` functions (`formatMoney`, `parseDate`, `isWeekend`, `slugify`, `chunk`, `retry`, `describeOrder`), `customers.js` functions (`findCustomer`, `customerSlug`). | Write test cases for all exported functions, with focus on: (1) `parseDate` with valid and invalid inputs; (2) `isWeekend` with multiple weekday/weekend dates; (3) `formatMoney` with edge cases (0, single digit, negative); (4) `retry` with different attempt counts; (5) `describeOrder` with missing customers. |
| 4 | Medium | Correctness | `retry()` function behavior inconsistent with typical retry semantics | `src/util.js:35-41` — Function parameter is `times`, and the loop runs `for (let i = 0; i < times; i += 1)`, meaning it attempts exactly `times` times. With `times = 1`, it makes only 1 attempt (no retries). Typical convention is that `times` or `retries` parameter means "number of retries after initial attempt." This creates confusion and potential off-by-one errors in callers. | Rename the parameter to clarify intent (e.g., `attempts` if it means total attempts), or add clear JSDoc comment explaining the semantics. Alternatively, restructure to `attempts - 1` inside the loop if the intent is to match the typical "retries after first" pattern. |
| 5 | Low | Maintainability | `util.js` module has mixed concerns | `src/util.js` contains 7 exported functions spanning: money formatting, order description (business logic combining pricing + customers), text slugification, date parsing, date classification, array chunking, and retry logic. README acknowledges: "It has grown a bit." No clear separation of concerns; functions grouped only by "shared" status. | Consider splitting into focused modules: `format-utils.js` (formatMoney, slugify), `date-utils.js` (parseDate, isWeekend), `retry-utils.js` (retry), and `order-utils.js` (describeOrder). This improves discoverability and reduces the mental load of a "grab bag" module. This change should follow resolution of finding #2 (circular dependency). |

---

## Unconfirmed Issues

**Test execution blocked:** Cannot confirm test suite passes without running it. The command `npm test` could not execute in the evaluation environment. Two test cases are visible in `test/pricing.test.js` (weekday and weekend orders), and their logic appears sound, but full coverage of edge cases remains unverified.

---

## Summary

### Strengths

1. **Clear naming and readable code** — Function names are descriptive (`priceFor`, `findCustomer`, `slugify`), and code is concise without unnecessary complexity. The logic is easy to follow at a glance.

2. **No external dependencies** — The package relies only on Node.js built-ins (`node:test`, `node:assert`), reducing supply-chain risk and deployment complexity.

3. **Sensible fallback behavior** — `findCustomer()` returning a default "Unknown" customer (`src/customers.js:9`) prevents null reference errors and gracefully handles missing data.

### Key Risks

1. **Circular dependency (Finding #2)** — The `util.js` ↔ `pricing.js` cycle creates initialization order brittleness. If either module is used in isolation or in a different module system (bundler, CommonJS conversion), the cycle can break. This blocks clean separation for reuse.

2. **Silent date parsing failures (Finding #1)** — Malformed dates in `order.date` produce NaN values that silently fail in `isWeekend()`, causing incorrect pricing (no weekend surcharge applied). This is a correctness bug with business logic impact. A production order placed on a weekend with an invalid date string would be underpriced.

3. **Test coverage gaps (Finding #3)** — Most utility functions have no automated tests. 5 of 7 functions in `util.js` and both functions in `customers.js` are untested. The `retry()` function in particular lacks tests for edge cases (attempts = 0, attempts = 1, multiple error types).

### Priority Order

1. **Add input validation to `parseDate()`** (Finding #1) — Blocks production use. Prevents silent pricing errors. ~30 min.

2. **Resolve circular dependency** (Finding #2) — Extract `isWeekend()` or date utilities to a new module. Required before splitting this package for reuse. ~45 min.

3. **Write comprehensive tests** (Finding #3) — Add test cases for all untested functions, especially `retry()`, `formatMoney()`, and edge cases in `parseDate()`. ~1–2 hours.

4. **Refactor `retry()` semantics or document clearly** (Finding #4) — Clarify the `times` parameter intent through naming or JSDoc. ~15 min.

5. **Consider splitting `util.js`** (Finding #5) — Lower priority. Improves module cohesion but is not a blocker. Defer until after #1–#3 are addressed. ~1 hour.

### Coverage Gaps

- **Test execution:** Could not run the test suite to confirm passes/failures; relied on code inspection only.
- **Runtime behavior:** No dynamic analysis (e.g., checking actual error handling under load, verifying retry logic with real failures).
- **Linting & type checking:** No eslint, TypeScript, or JSDoc type checking tools available; would detect additional style and type issues.
- **Integration testing:** No tests confirming how this package integrates with consuming code that calls `describeOrder()`, `priceFor()`, etc.
- **Performance testing:** No benchmarks on `chunk()`, `retry()`, or `findCustomer()` with large datasets.
- **Date edge cases:** Leap years, month boundaries, and century boundaries in `isWeekend()` not systematically tested.

---

## What I Verified

1. ✓ All source files and tests read in full
2. ✓ Package structure and dependencies identified (no external deps)
3. ✓ Circular dependency detected between util.js and pricing.js
4. ✓ Test coverage mapped (only 2 tests, most functions uncovered)
5. ✓ Date parsing behavior analyzed for error handling
6. ✓ Code readability and naming conventions confirmed as consistent
7. ✗ Test suite execution blocked (approval required)
8. ✗ Automated linting and type checking unavailable
