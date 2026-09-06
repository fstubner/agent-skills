# Engineering Assessment: orders-core

This assessment evaluates the `orders-core` package prior to splitting it out for reuse.

---

## 1. Scope

- **In Scope**: All files within `src/` (`customers.js`, `pricing.js`, `util.js`), `test/` (`pricing.test.js`), `package.json`, and `README.md`.
- **Out of Scope**: External consumers or downstream services (none present in workspace).
- **Depth**: `deep` — all files in scope examined in full, tool checks attempted and recorded.

### Enumerated Files
- `package.json`
- `README.md`
- `src/customers.js`
- `src/pricing.js`
- `src/util.js`
- `test/pricing.test.js`

---

## 2. Environment

- **Language / Runtime**: JavaScript (ES Modules, Node.js v22+ built-in test runner).
- **Domain**: Core library / reusable module (`orders-core`).
- **Build & Tooling**: Node.js native test runner (`node --test`).

---

## 3. Tooling Results

### What I Ran

1. **`npm test`**
   - **Command**: `npm test`
   - **Status**: Success (Exit code 0)
   - **Output**:
     ```text
     > test
     > node --test test/pricing.test.js

     ✔ a weekday order has no surcharge (0.8943ms)
     ✔ a weekend order carries the surcharge (0.1393ms)
     ℹ tests 2
     ℹ suites 0
     ℹ pass 2
     ℹ fail 0
     ℹ cancelled 0
     ℹ skipped 0
     ℹ todo 0
     ℹ duration_ms 208.4119
     ```

2. **`npx eslint .`**
   - **Command**: `npx eslint .`
   - **Status**: Failed (Exit code 1)
   - **Reason**: ESLint configuration / package not installed in workspace.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Architecture | Circular module dependency between `util.js`, `customers.js`, and `pricing.js`. | `src/util.js:2-3` imports `priceFor` and `findCustomer`; `src/customers.js:1` imports `slugify` from `util.js`; `src/pricing.js:1` imports `isWeekend` from `util.js`. | Decouple `util.js` by extracting standalone utility functions (`slugify`, `isWeekend`, etc.) into dedicated module(s) or standard utilities, removing high-level domain imports (`priceFor`, `findCustomer`) from `util.js`. |
| 2 | High | Correctness / API Design | Package main entry point points to `src/util.js`, causing cyclic dependency graphs for consumers importing the entry point. | `package.json:4` (`"main": "src/util.js"`); `src/util.js:2-3` imports `customers.js` & `pricing.js`. | Define a dedicated `index.js` entry point that exports a clean public API, or direct exports without cyclic imports. |
| 3 | Medium | Correctness | Negative monetary amounts wrap incorrectly in `formatMoney`. | `src/util.js:5-7`: `Math.floor(-250 / 100)` evaluates to `-3`, while `String(-250 % 100).padStart(2, '0')` yields `"-50"`, returning `"-3.-50"`. | Handle sign explicitly before splitting units and fractional cents (e.g. using `Math.abs` on minor units and prepending minus sign). |
| 4 | Medium | Maintainability / Reliability | Test suite only runs `test/pricing.test.js`, leaving `customers.js` and `util.js` completely un-tested. | `package.json:5` script runs `node --test test/pricing.test.js`; no tests exist for `customers.js` or `util.js`. | Update test script to `node --test test/*.test.js` or `node --test` and add tests for `customers.js` and `util.js`. |
| 5 | Low | Robustness | `parseDate` blindly splits string input without format validation. | `src/util.js:18-21`: `parseDate` assumes `"YYYY-MM-DD"` formatted input string without checking validity. | Add basic input validation / regex check or handle invalid date strings gracefully. |

---

## 6. Summary

### Strengths
- Clean and readable code implementation with zero external runtime dependencies.
- Simple testing setup utilizing standard Node.js native test runner (`node --test`).

### Key Risks
- **Cyclic Module Dependencies**: Consuming `orders-core` via its entry point (`src/util.js`) triggers circular imports between `util.js`, `customers.js`, and `pricing.js` (Finding #1, #2).
- **Missing Test Coverage**: Critical business helper logic (`formatMoney`, `describeOrder`, `slugify`, `isWeekend`, `retry`, `chunk`) is entirely un-tested (Finding #4).

### Priority Order
1. **Fix package entry point and remove circular dependencies** (Findings #1, #2): Define an `index.js` barrel/entry file and re-organize low-level utilities.
2. **Expand automated tests** (Finding #4): Cover `customers.js` and `util.js` functions under `test/`.
3. **Fix `formatMoney` edge cases** (Finding #3): Support negative numbers cleanly.
4. **Add input validation** (Finding #5): Safeguard date parsing and formatting against malformed inputs.

### Coverage Gaps
- Performance/benchmarking under load was not tested.
- Static analysis / linting tools were unavailable due to missing workspace dependencies.
