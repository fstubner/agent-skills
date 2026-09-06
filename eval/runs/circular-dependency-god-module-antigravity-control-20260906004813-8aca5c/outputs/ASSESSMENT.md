# Engineering Assessment: orders-core

## 1. Scope
- **In scope**: All files in workspace: `package.json`, `README.md`, `src/customers.js`, `src/pricing.js`, `src/util.js`, `test/pricing.test.js`.
- **Out of scope**: External consumers, CI setup (none present in workspace).
- **Depth**: `deep` — all in-scope files inspected line-by-line; workspace structure, dependencies, circular modules, test coverage, package layout, and claims verified via node test commands.

---

## 2. Environment
- **Languages & Runtimes**: Node.js ES Modules (`"type": "module"`).
- **Frameworks & Libraries**: Node.js built-in test runner (`node:test`, `node:assert`). Zero external npm dependencies.
- **Domain**: Utility package for pricing calculations, customer lookups, and shared formatting/helpers.
- **Build System**: Native Node.js script execution.

---

## 3. Tooling Results

### What I ran
```shell
$ npm test

> test
> node --test test/pricing.test.js

✔ a weekday order has no surcharge (1.2018ms)
✔ a weekend order carries the surcharge (0.1621ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 340.1585
```

- **Tools run successfully**: `npm test` (exited 0, 2 tests passed).
- **Tools unavailable / not attempted**: Linter (`eslint`), Type checker (`tsc`), Audit (`npm audit` — no dependencies).

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Architecture | **Circular Dependency between `src/util.js` and `src/pricing.js` / `src/customers.js`** | `src/util.js:2-3` imports `priceFor` and `findCustomer` from `pricing.js` and `customers.js`. `src/pricing.js:1` imports `isWeekend` from `util.js`. `src/customers.js:1` imports `slugify` from `util.js`. | Refactor module boundaries so generic utility functions (`isWeekend`, `slugify`) are isolated from higher-level domain functions (`describeOrder`), eliminating circular module imports. |
| 2 | High | Correctness | **Inaccurate Claims in `README.md`** | `README.md:5-6` states: *"src/util.js holds anything shared. It has grown a bit but everything in it is used somewhere, so there is nothing to remove."* However, `formatMoney` (`src/util.js:5`), `describeOrder` (`src/util.js:9`), `chunk` (`src/util.js:29`), and `retry` (`src/util.js:35`) are completely unused internally by `pricing.js`, `customers.js`, or `test/pricing.test.js`. | Update documentation to reflect true usage, or break up `util.js` into domain-specific modules before exporting as a reusable package. |
| 3 | Medium | Maintainability / Reliability | **Missing Test Coverage for Customers & Util Modules** | `package.json:5` only executes `test/pricing.test.js`. `customers.js` and `util.js` have 0 test coverage. | Add test suites covering `customers.js` functions and `util.js` helpers (`formatMoney`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`, `describeOrder`). |
| 4 | Low | Correctness | **Potential Floating Point / Negative Modulo Issues in `formatMoney`** | `src/util.js:6` uses `Math.floor(minor / 100)` and `minor % 100`. Negative values (e.g. `-150`) result in `-2.-50` instead of `-1.50`. | Use proper money formatting math handling sign and integer cents, or standard currency libraries. |

---

## 5. Unconfirmed Issues

- **Date parsing bounds validation**: `parseDate` (`src/util.js:18`) splits strings on `-` without validating date formats or ranges. If invalid input is passed, `Date.UTC` produces `NaN`. (Requires consumer input contracts).

---

## 6. Summary

### Strengths
1. Zero external dependencies, keeping the footprint minimal and installation fast.
2. Uses standard Node.js native ESM and native test runner (`node:test`).

### Key Risks
- Circular dependencies between `util.js`, `pricing.js`, and `customers.js` make reuse fragile and prone to initialization errors when imported into external projects (Ref Finding #1).
- Over half the functions in `util.js` and `customers.js` have zero test coverage (Ref Finding #3).

### Priority Order
1. Break circular dependency between `util.js`, `pricing.js`, and `customers.js`.
2. Add unit tests for `customers.js` and `util.js`.
3. Correct documentation in `README.md` regarding `util.js` scope and contents.
4. Harden utility helpers (`formatMoney`, `parseDate`) against edge cases.

### Coverage Gaps
- External consumers of `orders-core` were not examined as they are outside the workspace.
- No linter or type-checker was configured in the repository.
