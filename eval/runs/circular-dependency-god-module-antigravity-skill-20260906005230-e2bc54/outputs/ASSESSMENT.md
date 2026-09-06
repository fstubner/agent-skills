# Engineering Assessment: `orders-core`

## 1. Scope

- **In scope**: All source files (`src/pricing.js`, `src/customers.js`, `src/util.js`), configuration (`package.json`), documentation (`README.md`), and test suite (`test/pricing.test.js`).
- **Out of scope**: External consumers or repositories consuming `orders-core` prior to export.
- **Depth**: `targeted` (Every in-scope file read and evaluated in full).

---

## 2. Environment

- **Languages and Runtimes**: Node.js ES Modules (`"type": "module"` in `package.json`).
- **Frameworks and Libraries**: Node built-in test runner (`node:test`, `node:assert`). No third-party NPM dependencies.
- **Domain**: Core domain model, pricing logic, customer directory, and utility functions for order management.
- **Platform Targets**: Server-side Node.js environment.
- **Build Systems and Tooling**: `npm test` script invoking `node --test test/pricing.test.js`.

---

## 3. Tooling Results

### What I ran

| Command | Status | Result / Snippet |
|---------|--------|------------------|
| `npm test` | Executed successfully (Exit 0) | `✔ a weekday order has no surcharge`<br>`✔ a weekend order carries the surcharge`<br>`ℹ tests 2, pass 2, fail 0` |
| `tsc --noEmit` / `eslint` | Not attempted | No TypeScript configuration (`tsconfig.json`) or ESLint setup present in package. |
| `npm audit` | Executed successfully | `found 0 vulnerabilities` (0 dependencies declared). |

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | High | Architecture / Reusability | Circular dependency between `src/util.js` and `src/pricing.js` / `src/customers.js` creates fragile module coupling. | [util.js:2-3](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/src/util.js#L2-L3) imports `priceFor` from `pricing.js` & `findCustomer` from `customers.js`, while [pricing.js:1](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/src/pricing.js#L1) imports `isWeekend` from `util.js` and [customers.js:1](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/src/customers.js#L1) imports `slugify` from `util.js`. | Refactor shared helpers (e.g. `isWeekend`, `slugify`, `formatMoney`) out of `util.js` into focused utility/domain files so module dependencies flow unidirectionally. |
| 2 | High | Reusability / Architecture | Package entry point (`"main": "src/util.js"`) imports the entire domain module graph instead of exposing a clean public API surface. | [package.json:4](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/package.json#L4) sets `"main": "src/util.js"`, forcing consumers to import `util.js` or internal paths directly. | Create an explicit `src/index.js` export barrel or use `package.json` `"exports"` field to define a clean public API boundary. |
| 3 | Medium | Correctness | `formatMoney` produces invalid string formatting for negative values or non-integer amounts. | Running `formatMoney(-50)` yields `"-1.-50"` due to `Math.floor` and `% 100` handling of negative integers at [util.js:5-7](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/src/util.js#L5-L7). | Handle sign explicitly (`Math.abs(minor)`) and prepend `-` for negative balances. |
| 4 | Medium | Correctness / Reliability | `parseDate` and `isWeekend` assume strict `'YYYY-MM-DD'` formatted string inputs without validation, risking `NaN` or incorrect date calculations. | [util.js:18-27](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/src/util.js#L18-L27) splits on `-` and passes `month - 1` to `Date.UTC`. Invalid strings yield `NaN` components. | Validate date format before parsing or throw descriptive errors on invalid inputs. |
| 5 | Medium | Maintainability / Testing | Test coverage is incomplete; `customers.js` and `util.js` functions have zero unit tests. | [package.json:5](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/package.json#L5) only runs `test/pricing.test.js`. `describeOrder`, `slugify`, `formatMoney`, `chunk`, `findCustomer`, and `retry` are un-tested. | Expand test suite to cover `customers.js` and `util.js` functions before reusing package. |
| 6 | Low | Maintainability | `README.md` documents `src/util.js` as an unorganized catch-all file. | [README.md:5-6](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/README.md#L5-L6) states `src/util.js holds anything shared. It has grown a bit...`. | Reorganize utilities by responsibility before package extraction. |

---

## 5. Unconfirmed Issues

- **Performance of `retry` helper on async functions**: `retry()` at [util.js:35-41](file:///C:/tmp/agent-skills-eval-FeRjBI/workspace/src/util.js#L35-L41) is synchronous. If intended for asynchronous operations (e.g. network/DB retries), it will not await promises. Requires clarification on intended usage before reuse.

---

## 6. Summary

### Strengths

- Clean, dependency-free implementation using standard Node.js ES modules and standard node test runner.
- Clear and concise domain logic in `src/pricing.js` and `src/customers.js`.

### Key Risks

- **Circular Module Dependencies** (Finding #1): `src/util.js` imports from domain files while domain files import from `src/util.js`.
- **Packaging & Entry Point** (Finding #2): `package.json` points to `src/util.js` as the package main entry point, exposing kitchen-sink internals.
- **Edge-Case Formatting Defect** (Finding #3): Monetary formatting breaks on negative input values.

### Priority Order

1. **Break Circular Dependencies**: Move leaf utilities (`slugify`, `parseDate`, `isWeekend`) out of `util.js` so `pricing.js` and `customers.js` do not depend on `util.js`.
2. **Define Package API Surface**: Change `main` entry point or add `exports` map in `package.json` to expose a clean public API (`index.js`).
3. **Fix `formatMoney` Math**: Update string formatting logic in `formatMoney` to handle negative integer amounts correctly.
4. **Expand Test Coverage**: Add unit tests for `customers.js` and `util.js` helper functions in `test/`.

### Coverage Gaps

- Static analysis (ESLint) and Type Checking (TypeScript / JSDoc) were not evaluated as tooling is not configured in this project.
- Downstream consumer requirements and integration testing were not evaluated.
