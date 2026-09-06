# Engineering Assessment: `orders-core`

**Date**: September 6, 2026  
**Target Package**: `orders-core` (`C:\tmp\agent-skills-eval-gB2d0B\workspace`)  
**Purpose**: Evaluate package readiness, architecture, correctness, test coverage, and reusability prior to splitting out for shared use.

---

## 1. Scope

- **In Scope**:
  - `package.json` — manifest, entry point, script definitions.
  - `README.md` — package documentation.
  - `src/util.js` — shared utility functions and helpers.
  - `src/customers.js` — customer lookup and slug generation.
  - `src/pricing.js` — order pricing calculations.
  - `test/pricing.test.js` — existing automated test suite.
- **Out of Scope**: External consumers or parent applications using `orders-core`.
- **Assessment Depth**: `deep` — all in-scope source files, configurations, and tests were read and analyzed in full; automated test runner executed and results recorded.

---

## 2. Environment

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Test Framework**: Native Node test runner (`node --test`)
- **Dependencies**: 0 external npm dependencies (pure standard library / ESM)
- **Build System / Tooling**: npm scripts (`npm test`)

---

## 3. Tooling Results

### What I Ran

| Command | Status | Output Summary |
|---|---|---|
| `npm test` | **PASS** (Exit code 0) | `✔ a weekday order has no surcharge (3.12ms)`<br>`✔ a weekend order carries the surcharge (0.35ms)`<br>Total: 2 passed, 0 failed, duration ~379ms. |

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **High** | Correctness | Negative monetary values break `formatMoney` output formatting | `src/util.js:6` — `Math.floor(minor / 100)` and `minor % 100` produce negative outputs like `"-2.-50"` for `-150`. | Compute sign separately using `Math.abs` for integer/remainder splits, prepending `-` when negative. |
| 2 | **High** | Architecture | Circular dependencies create tight coupling between `util.js`, `customers.js`, and `pricing.js` | `src/util.js:2-3`, `src/customers.js:1`, `src/pricing.js:1` — 2-way cycles (`util` $\leftrightarrow$ `customers`, `util` $\leftrightarrow$ `pricing`). | Remove domain functions (`describeOrder`) from generic `util.js` or split utilities into atomic single-responsibility modules. |
| 3 | **High** | Architecture | Incomplete package exports contract in `package.json` | `package.json:4` — `"main": "src/util.js"`, no `"exports"` field defined. | Create a root index entry point (`src/index.js`) re-exporting public API symbols, and configure explicit `"exports"` in `package.json`. |
| 4 | **Medium** | Reliability | Infinite loop in `chunk()` when `size <= 0` | `src/util.js:29-33` — `for (let i = 0; i < rows.length; i += size)` | Validate `size > 0` before looping; throw a `RangeError` if invalid. |
| 5 | **Medium** | Reliability | `retry()` throws `undefined` when called with `times <= 0` | `src/util.js:35-41` — `let last;` uninitialized, thrown when loop doesn't execute. | Validate `times >= 1` and throw an `Error` if `times` is invalid or if `fn` fails on all attempts. |
| 6 | **Medium** | Maintainability | Hardcoded mock customer list limits package reusability | `src/customers.js:3-6` — `const CUSTOMERS = [...]` hardcoded in package source. | Decouple customer repository data store; allow external customer provider or data injection. |
| 7 | **Medium** | Maintainability | Major test coverage gap across utility functions and customer modules | `test/pricing.test.js:1-12` — 0 tests for `util.js` or `customers.js`. | Add unit test suites for `util.js` (`formatMoney`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`) and `customers.js`. |
| 8 | **Low** | Reliability | Missing defensive input validation on public utility functions | `src/util.js:14`, `src/util.js:18`, `src/pricing.js:5` — missing null/type guards. | Add input type checks or defensive defaults for public functions. |

---

## 5. Unconfirmed Issues

- **Floating-point rounding in monetary operations**: `formatMoney` accepts `minor` amounts. If non-integer floats are passed into `formatMoney(minor)`, `minor % 100` may produce unexpected floating point decimals. Direct evidence of usage with floats was not present in existing tests, but input validation/truncation should be verified before release.

---

## 6. Summary

### Strengths
- **Clean Standard ESM Codebase**: Uses native Node.js ES Modules without heavy transpilation or third-party runtime dependencies.
- **Fast Automated Tests**: Existing test runner (`node --test`) executes cleanly in under 400ms.

### Key Risks
- **Monetary Calculation Bug (Finding #1)**: Formatting negative balances or refunds results in invalid string outputs (`"-2.-50"`).
- **Circular Module Dependencies (Finding #2)**: Interdependent imports between `util.js`, `customers.js`, and `pricing.js` hinder modularity and risk runtime initialization errors when package boundaries change.
- **Missing Package Boundary / Exports (Finding #3)**: `package.json` only points to `src/util.js`, preventing clean package reuse without importing internal paths.

### Priority Order
1. **Fix monetary formatting logic** (`formatMoney` handling of negative numbers).
2. **Eliminate circular dependencies** by refactoring `util.js` into domain-agnostic helpers and moving `describeOrder` out to a dedicated order service/formatter.
3. **Define public API surface and `package.json` exports** (`src/index.js` + `"exports"` field).
4. **Guard against edge cases & infinite loops** in `chunk()` and `retry()`.
5. **Expand automated test coverage** for all exported utility and customer functions.
6. **Decouple static customer data** to accept external repositories/providers.

### Coverage Gaps
- **Downstream Application Integrations**: Out-of-scope code relying on `orders-core` was not evaluated.
- **Performance Benchmarks**: Memory usage and performance under high-throughput batch operations (e.g. large arrays passed to `chunk`) were not benchmarked.
