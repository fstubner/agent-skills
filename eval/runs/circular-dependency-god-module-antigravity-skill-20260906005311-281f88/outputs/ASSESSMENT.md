# Engineering Assessment: orders-core

## 1. Scope

- **In Scope**:
  - `package.json` — package configuration and entry point definitions.
  - `README.md` — package documentation.
  - `src/pricing.js` — order pricing calculations.
  - `src/customers.js` — customer lookup and slug generation.
  - `src/util.js` — general utility functions and shared helpers.
  - `test/pricing.test.js` — unit test suite for pricing logic.
- **Out of Scope**: None (all source and configuration files within the workspace were examined).
- **Depth**: `deep` — every file in the project was read in full, project commands were executed and recorded, and dependency/module analysis was conducted.

---

## 2. Environment

- **Languages & Runtimes**: Node.js (ES Modules, `"type": "module"`).
- **Frameworks & Libraries**: Node.js native test runner (`node:test`), native assertions (`node:assert`). No external runtime or dev dependencies declared.
- **Domain**: Domain library / reusable utility package (`orders-core`).
- **Platform Targets**: Node.js environment.
- **Build Systems & Tooling**: `npm` package manager, `node --test`.

---

## 3. Tooling Results

### What I Ran

1. **`npm test`**
   - **Status**: Passed (Exit code 0)
   - **Output**:
     ```text
     > test
     > node --test test/pricing.test.js

     ✔ a weekday order has no surcharge (1.3319ms)
     ✔ a weekend order carries the surcharge (0.2334ms)
     ℹ tests 2
     ℹ suites 0
     ℹ pass 2
     ℹ fail 0
     ℹ cancelled 0
     ℹ skipped 0
     ℹ todo 0
     ℹ duration_ms 285.7954
     ```

2. **`npm run build` / `npm run lint` / `npm run typecheck`**
   - **Status**: Failed to execute
   - **Reason**: No `build`, `lint`, or `typecheck` scripts defined in `package.json`.

3. **`npx tsc --noEmit`**
   - **Status**: Failed to execute
   - **Reason**: TypeScript non-existent / not installed in project dependencies.

4. **`npx eslint .`**
   - **Status**: Failed to execute
   - **Reason**: ESLint not installed or configured in project dependencies.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | High | Architecture | Circular dependency between `src/util.js`, `src/pricing.js`, and `src/customers.js` | `src/pricing.js:1` imports `isWeekend` from `src/util.js`, while `src/util.js:2` imports `priceFor` from `src/pricing.js`. Similarly `src/customers.js:1` imports `slugify` from `src/util.js`, while `src/util.js:3` imports `findCustomer` from `src/customers.js`. | Refactor shared utility functions (`isWeekend`, `slugify`) out of `src/util.js` into dedicated low-level helper modules (e.g. `src/dates.js`, `src/strings.js`), or remove domain imports (`priceFor`, `findCustomer`) from `src/util.js`. |
| 2 | High | Correctness | `formatMoney` produces invalid format for negative minor currency amounts | `src/util.js:5-7`: `Math.floor(-150 / 100)` yields `-2` and `-150 % 100` yields `-50`, causing `formatMoney(-150)` to return `"-2.-50"`. | Handle sign explicitly (e.g. format absolute value and prepend `-` if negative), or throw on negative inputs if unsupported. |
| 3 | Medium | Maintainability | Untested modules (`src/customers.js` and `src/util.js`) | Only `src/pricing.js` is tested via `test/pricing.test.js`. `src/customers.js` and `src/util.js` (`formatMoney`, `describeOrder`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`) have no test coverage. | Add dedicated unit test suites for `src/customers.js` and `src/util.js` prior to reusing the package. |
| 4 | Medium | Architecture | Wrong main entry point declared in `package.json` | `package.json:4` sets `"main": "src/util.js"`. Importing `orders-core` as a package will only expose `src/util.js` exports, omitting direct access to `pricing.js` and `customers.js` unless explicitly imported by subpath. | Create an index entry point (e.g. `src/index.js`) re-exporting the public API surface of the package, and update `"main"` in `package.json`. |
| 5 | Low | Maintainability | Misleading docstring / package description in `README.md` | `README.md:5-6` states "`src/util.js` holds anything shared... there is nothing to remove", masking tight coupling and circular dependencies. | Update documentation to describe module responsibilities accurately once refactored. |

---

## 5. Unconfirmed Issues

*None — all listed findings are confirmed with direct source evidence.*

---

## 6. Summary

### Strengths

- **Clean ESM & Zero Overhead**: Uses modern Node.js ES Modules natively with zero third-party production or build dependencies.
- **Fast Native Test Execution**: Uses Node.js native test runner (`node:test`), executing cleanly and quickly without external test harness overhead.

### Key Risks

- **Circular Dependencies (Finding #1)**: High risk when splitting for reuse; cyclic imports between domain modules (`pricing.js`, `customers.js`) and utility modules (`util.js`) can lead to uninitialized binding errors or module evaluation issues across different bundlers/runtimes.
- **Incorrect Math/Formatting (Finding #2)**: `formatMoney` breaks on negative numbers (e.g. producing `"-2.-50"` for `-150`), risking UI rendering bugs when handling refunds, discounts, or negative balances.
- **Incomplete Public API & Test Coverage (Findings #3, #4)**: `"main"` points to `src/util.js` rather than a unified entry point, and key modules (`customers.js`, `util.js`) completely lack test coverage.

### Priority Order

1. **Fix Circular Dependencies (Finding #1)**: Decouple `src/util.js` from `pricing.js` and `customers.js` by splitting generic date/string utilities into low-level helpers before exporting for reuse.
2. **Fix `formatMoney` Logic (Finding #2)**: Correct negative number handling in `formatMoney` to ensure valid currency formatting.
3. **Define Package API Surface (Finding #4)**: Create a unified `src/index.js` entry point and update `package.json` `"main"`.
4. **Expand Test Coverage (Finding #3)**: Write comprehensive unit tests for `util.js` and `customers.js`.
5. **Update Documentation (Finding #5)**: Revise `README.md` reflecting the new package structure.

### Coverage Gaps

- **Production Metrics / Usage Data**: No information on existing downstream consumers or expected input ranges (e.g. whether negative minor values occur in production).
- **Static Analysis / Linting**: No linter, static analysis, or type checker was configured or run in this repository.
