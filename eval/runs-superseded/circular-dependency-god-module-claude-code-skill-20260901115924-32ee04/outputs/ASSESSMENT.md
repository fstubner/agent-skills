# Engineering Assessment: Orders Core Package

## Scope

**In scope (targeted depth):**
- Source modules: `src/util.js`, `src/pricing.js`, `src/customers.js`
- Test file: `test/pricing.test.js`
- Configuration: `package.json`, `README.md`

**Out of scope:**
- Integration with other systems or consumers
- Production deployment configuration
- Performance benchmarks or load testing

**Depth: Targeted** — All in-scope files read in full; automated checks attempted; suspected issues examined for direct evidence.

---

## Environment

**Language & Runtime:** JavaScript (Node.js v24.14.1), ES modules

**Build/Test Tools:** Node.js built-in test runner

**Domain:** Pricing and customer management library (shared helpers for order processing)

**Main Entry:** `src/util.js` (defined in package.json)

**Package Metadata:**
- Name: `orders-core`
- Type: ES module
- No external dependencies listed

---

## Tooling Results

### What I ran

| Command | Result |
|---------|--------|
| `node --test test/pricing.test.js` | **Could not execute** — Bash execution permissions required for test invocation; not completed |
| `node --version` | **Success** — v24.14.1 available |

**Summary:** Test runner command required explicit approval in this environment and was not executed. All code analysis proceeded from static reading of source and test files.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | High | Correctness | `parseDate()` lacks input validation; malformed dates cause silent failures | `src/util.js:18–20` — `split('-').map(Number)` on invalid input yields `NaN` values that propagate silently to `isWeekend()` | Validate date format before parsing; throw descriptive error on invalid input. Example: `if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(...)` |
| 2 | High | Architecture | Circular module dependencies between `util.js`, `pricing.js`, and `customers.js` | `util.js:2–3` imports `priceFor` from `pricing.js` and `findCustomer` from `customers.js`; both `pricing.js:1` and `customers.js:1` import from `util.js` | Extract shared utilities (`formatMoney`, `slugify`, `chunk`, `retry`) to a separate module (e.g., `helpers.js`); move `parseDate`, `isWeekend` to `pricing.js` or a date-utils module. This breaks the cycle. |
| 3 | Medium | Reliability | `retry()` function has no delay between attempts; rapid retries may worsen transient failures | `src/util.js:35–41` — tight loop with no backoff; repeating identical failing calls in quick succession is ineffective | Add exponential backoff or fixed delay between attempts. Example: `setTimeout(() => { ... }, i * 100)` or similar. If synchronous retry is required, document why. |
| 4 | Medium | Maintainability | Test coverage is incomplete; only `priceFor()` tested, other public exports untested | `test/pricing.test.js` — 2 tests covering only pricing logic; no tests for `formatMoney`, `describeOrder`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`, `findCustomer`, `customerSlug` | Add tests for: (1) `parseDate` with valid and invalid dates; (2) `isWeekend` with known weekend/weekday dates; (3) `formatMoney` with edge cases (0, odd cents); (4) `slugify` with special characters, case handling; (5) `chunk` with sizes that don't divide evenly; (6) `retry` success/failure scenarios. |
| 5 | Medium | Correctness | `describeOrder()` assumes customer exists; returns fallback name "Unknown" without indication of data integrity issue | `src/util.js:9–11` calls `findCustomer()`; `customers.js:8–9` returns `{ id, name: 'Unknown' }` for missing customers; inconsistency hidden from caller | Document behavior explicitly: either (1) throw on missing customer, signaling a data problem, or (2) return a tuple `[order, isKnownCustomer]` so callers can handle gracefully. Current silent fallback masks data quality issues. |
| 6 | Low | Maintainability | README mentions `src/util.js` has "grown a bit" but all is used; no further detail on module coherence | `README.md` — claim that everything is used is accurate but provides no guidance for future maintainers on what exports belong together | Add brief export inventory to README: list which functions are for dates, formatting, collection ops, retries, etc. This context aids future refactoring. |

---

## Unconfirmed Issues

None. All findings above are grounded in specific evidence from the code.

---

## Summary

### Strengths

1. **Clear, focused modules with single responsibilities**: `pricing.js` and `customers.js` are tightly scoped; `priceFor()` and `findCustomer()` each do one thing well.

2. **Effective use of pure functions**: Most utilities (`formatMoney`, `slugify`, `chunk`, `parseDate`, `isWeekend`) are side-effect-free and easily testable, lowering maintenance burden.

3. **Simple, transparent data structures**: No complex inheritance or mutable state; easy to reason about data flow.

### Key Risks

1. **Circular dependencies (Finding #2)** — While JavaScript's module system permits cycles, they are a maintainability hazard and complicate debugging. This should be broken early before the package is published and consumed elsewhere.

2. **Input validation gaps (Finding #1)** — `parseDate()` silently accepts malformed input (e.g., `"invalid"` → `{ year: NaN, month: NaN, day: NaN }`), and `isWeekend()` propagates this silently. This can cause subtle bugs when invalid dates enter the system (e.g., from external APIs or user input).

3. **Test coverage is narrow (Finding #4)** — Only 2 tests cover 1 of ~10 public functions. This means the package has not been validated for edge cases or defensive use, increasing risk when shared with other teams.

4. **Silent fallback for missing data (Finding #5)** — `describeOrder()` uses a generic "Unknown" name for missing customers. Callers cannot distinguish between legitimate edge cases and data corruption, complicating debugging.

### Priority Order

1. **Fix circular dependencies (Finding #2)** — High effort but foundational. Must be done before packaging for reuse; consuming code will be brittle if cycles remain.

2. **Add input validation to `parseDate()` (Finding #1)** — Low effort, high impact. Prevents silent NaN propagation and catches bad input early.

3. **Expand test coverage (Finding #4)** — Medium effort. Focus on `parseDate` / `isWeekend` validation logic first (linked to Finding #1), then other core functions. This is essential before the package is shared.

4. **Document or change missing-customer behavior (Finding #5)** — Low effort. Decide: throw loudly (fail fast), or return a sentinel value (allow graceful fallback). Document the choice.

5. **Add backoff to `retry()` (Finding #3)** — Medium effort. Low current priority if retry is not yet used in production, but document whether synchronous retry-without-delay is intentional.

### Coverage Gaps

- **Automated testing:** Could not execute the test runner in this environment; test results are not available. Assumption: the 2 tests pass, but no evidence of full suite success.
- **Linting / formatting:** No ESLint or Prettier configuration present; code style compliance not checked.
- **Type safety:** No TypeScript or JSDoc type annotations; runtime type errors are uncaught.
- **Dependency analysis:** No `npm audit` or security scanner output; unknown if any indirect dependencies exist or have known vulnerabilities.
- **Performance profiling:** No benchmarks or profiling data; memory and CPU characteristics unknown.
- **Browser / Node.js compatibility:** Package declares ES modules but no explicit Node.js version constraint; compatibility with different Node.js versions not verified.

---

## What I Verified

✓ All source files read in full  
✓ Module imports and exports traced for correctness and circular references  
✓ Test file examined for coverage completeness  
✓ Package metadata checked against source structure  
✓ Input validation and error handling pathways reviewed  
✓ 6 confirmed findings identified with specific file/line evidence
