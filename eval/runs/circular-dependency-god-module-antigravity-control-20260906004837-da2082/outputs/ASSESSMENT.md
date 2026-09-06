# Engineering Assessment: orders-core

## 1. Scope
- **Examine**: Entire repository (`README.md`, `package.json`, `src/customers.js`, `src/pricing.js`, `src/util.js`, `test/pricing.test.js`).
- **Depth**: `deep` — all files in the repository read in full; all declared scripts and automated checks executed.
- **Out of scope**: External consumers or downstream applications not included in this repository.

## 2. Environment
- **Languages & Runtimes**: JavaScript (Node.js ES Modules, `"type": "module"`).
- **Frameworks & Libraries**: Node.js native test runner (`node:test`, `node:assert`).
- **Domain & Target**: Utility package / shared core module (`orders-core`).
- **Build Systems & Tooling**: npm.

## 3. Tooling Results

### What I Ran

```sh
$ npm test

> test
> node --test test/pricing.test.js

✔ a weekday order has no surcharge (1.8899ms)
✔ a weekend order carries the surcharge (0.3854ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 317.8671
```

- **Tools run successfully**: `npm test` (passed 2/2 tests in `test/pricing.test.js`).
- **Tools unavailable**: `eslint`, `prettier`, `tsc` (no linting, formatting, or type-checking configurations/dependencies present in `package.json`).
- **Tools not attempted**: N/A.

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | High | Architecture | Circular module dependency between `util.js`, `pricing.js`, and `customers.js` creates tight coupling and cyclic imports. | `src/util.js:2-3` imports `priceFor` and `findCustomer`; `src/pricing.js:1` imports `isWeekend` from `util.js`; `src/customers.js:1` imports `slugify` from `util.js`. | Re-architect entry points and module boundaries: move `describeOrder` or domain logic out of `util.js` so core utilities do not import domain modules. |
| 2 | High | Maintainability / Packaging | Entry point defined in `package.json` (`"main": "src/util.js"`) re-exports domain logic and creates recursive dependency graphs for consumers. | `package.json:4` (`"main": "src/util.js"`) and `src/util.js:9-12` (`describeOrder`). | Expose a clean index/entry file or decouple package exports before reusing as a published package. |
| 3 | Medium | Correctness | `formatMoney` improperly handles negative cent amounts, producing invalid currency strings (e.g. `formatMoney(-150)` returns `"-2.50"` or `formatMoney(-50)` returns `"-1.-50"`). | `src/util.js:5-7` — uses `Math.floor(minor / 100)` and `minor % 100` without sign handling. | Handle negative inputs explicitly before formatting or use `Intl.NumberFormat`. |
| 4 | Medium | Testing | Missing test coverage for `customers.js` and all helpers in `util.js` (`formatMoney`, `describeOrder`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`). | `test/` directory contains only `test/pricing.test.js` covering `priceFor`. | Add unit tests for `customers.js` and functions in `util.js`. |
| 5 | Low | Reliability | `retry` helper re-throws `undefined` if `times` parameter is `<= 0`. | `src/util.js:35-41` — `let last;` is never assigned if loop body doesn't execute, throwing `undefined`. | Validate `times > 0` or throw a descriptive Error when loop does not execute. |

## 5. Unconfirmed Issues

- **None**: All findings listed above are confirmed by reading the code and analyzing module dependency graphs.

## 6. Summary

### Strengths
- Uses modern Node.js native ES modules (`"type": "module"`) and built-in `node:test` test runner without heavy external dependencies.
- Clear and simple implementation for base domain operations (`priceFor`, `findCustomer`).

### Key Risks
- **Cyclic Module Dependencies**: Splitting this package out for reuse in its current state will cause circular dependency issues (`util.js` <-> `pricing.js` / `customers.js`).
- **Inadequate Packaging Contract**: `"main": "src/util.js"` forces consumers into importing the entire cyclic graph.
- **Low Test Coverage**: Only `pricing.js` is tested; edge cases in `util.js` (such as negative currency formatting) are unchecked.

### Priority Order
1. **Fix Circular Dependencies**: Decouple `util.js` from `pricing.js` and `customers.js` (Findings #1, #2).
2. **Expand Test Suite**: Add tests for `util.js` and `customers.js` (Finding #4).
3. **Fix Formatting Edge Cases**: Fix negative amount handling in `formatMoney` (Finding #3).
4. **Harden Utilities**: Handle non-positive `times` argument in `retry` (Finding #5).

### Coverage Gaps
- Automated linting, static analysis, and type checking were not performed as no tools/configs exist in the repository.
- Downstream usage patterns in external applications were not examined.
