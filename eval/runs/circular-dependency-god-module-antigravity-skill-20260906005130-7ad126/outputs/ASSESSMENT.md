# Engineering Assessment: orders-core

This assessment evaluates `orders-core` prior to splitting it out for reuse across projects.

---

## 1. Scope

- **In Scope**: All package source files (`src/customers.js`, `src/pricing.js`, `src/util.js`), test suite (`test/pricing.test.js`), package configuration (`package.json`), and project documentation (`README.md`).
- **Out of Scope**: External consumers of this package, upstream deployment/build pipelines.
- **Depth**: `deep` — every file in scope was read in full, project scripts were executed, static dependency graphs were analyzed, and additional runtime edge-cases were tested.

---

## 2. Environment

- **Language / Runtime**: JavaScript (ES Modules, `type: "module"` in `package.json`), Node.js (v22 / standard `node --test` runner).
- **Frameworks & Libraries**: Zero external dependencies (`dependencies` and `devDependencies` are empty).
- **Domain**: Core e-commerce domain library (pricing calculations, customer mapping, formatting, utility helpers).
- **Build System**: Plain Node.js execution without build/transpilation steps.

---

## 3. Tooling Results

- **What I ran**:
  - `npm test`
    - **Command**: `npm test` (`node --test test/pricing.test.js`)
    - **Result**: Passed (2 tests passed, 0 failed, duration ~410ms).
  - Dependency Cycle Verification:
    - **Command**: Direct import evaluation via `node -e "import('./src/util.js')"` and `node -e "import('./src/customers.js')"`
    - **Result**: Successfully resolved, but circular module dependency graph confirmed between `util.js` and `customers.js`.
  - Additional Automated Checks (Lint, Typecheck, Audit, Format):
    - **Result**: Unavailable — no linter (ESLint), type checker (TypeScript/JSDoc), formatter (Prettier), or audit configurations exist in `package.json`.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | High | Architecture | Circular dependency between `src/util.js` and `src/customers.js` | `src/customers.js:1` imports `slugify` from `./util.js`; `src/util.js:3` imports `findCustomer` from `./customers.js`. | Refactor module boundaries before extracting. Move general string/date helpers (`slugify`, `parseDate`, etc.) out of `util.js` into focused utility modules (e.g. `src/string.js`) so domain modules do not depend on catch-all orchestrators. |
| 2 | High | Correctness | `formatMoney` produces invalid output for negative minor units | `src/util.js:6`: `Math.floor(-150 / 100)` yields `-2` and `-150 % 100` yields `-50`, producing output `"-2.-50"`. | Handle sign explicitly in money formatting (e.g., `const sign = minor < 0 ? '-' : ''; const abs = Math.abs(minor); ...`). |
| 3 | Medium | Maintainability | `src/util.js` acts as an unstructured catch-all module | `src/util.js:1-41` aggregates unrelated concerns: domain formatting (`describeOrder`), date parsing (`parseDate`, `isWeekend`), string transformation (`slugify`), array chunking (`chunk`), and function retries (`retry`). | Group utilities by single responsibility (`date.js`, `array.js`, `format.js`) before publishing for reuse. |
| 4 | Medium | Correctness | `parseDate` and `isWeekend` produce `NaN` or miscalculated days for invalid date formats | `src/util.js:19,25`: `parseDate` assumes `"YYYY-MM-DD"` string layout without input validation. | Add input validation or use standard Date parsing to prevent silent calculation errors. |
| 5 | Medium | Maintainability | Limited test coverage across core utility and customer logic | `test/pricing.test.js:1-12` only tests `priceFor`. `util.js` and `customers.js` have 0% test coverage. | Add comprehensive test suites for `customers.js` and all utility helpers in `util.js` before releasing as a shared library. |
| 6 | Low | Maintainability | Hardcoded static customer dataset inside domain logic | `src/customers.js:3-6` hardcodes a 2-element array `CUSTOMERS`. | Decouple data retrieval by accepting customer lookup providers or data repositories as arguments. |

---

## 5. Unconfirmed Issues

- **Retry synchronous / asynchronous expectation**: `src/util.js:35-41` implements a synchronous retry loop. If callers expect `retry` to work with asynchronous functions returning Promises, it will return unhandled Promise rejections instead of retrying. *Requires confirmation of intended package consumer API requirements.*

---

## 6. Summary

### Strengths
- **Clean zero-dependency design**: Uses standard Node.js test runner (`node --test`) and native ES modules without heavy external dependencies.
- **Passing baseline pricing tests**: The existing pricing logic tests pass cleanly for weekday and weekend calculations.

### Key Risks
- **Packaging / Module Graph Risk (Finding #1, Finding #3)**: The circular import (`util.js` <-> `customers.js`) and catch-all nature of `util.js` make clean reuse difficult and create tight coupling risks for downstream consumers.
- **Financial Calculation Formatting Bug (Finding #2)**: `formatMoney` fails on negative monetary values.

### Priority Order
1. **Break circular dependency (Finding #1)**: Extract primitive string utilities like `slugify` out of `util.js` into dedicated files so domain modules can safely import them.
2. **Fix monetary formatting for negative values (Finding #2)**: Update `formatMoney` to format absolute values and prepend negative signs correctly.
3. **Decompose `src/util.js` (Finding #3)**: Reorganize functions into cohesive modules (`date.js`, `string.js`, `array.js`, `function.js`).
4. **Expand test coverage (Finding #5)**: Create test suites for `util.js` and `customers.js`.
5. **Decouple data storage & validate inputs (Findings #4, #6)**: Provide input guards on date parsing and parameterize customer data fetching.

### Coverage Gaps
- **Automated Linting & Type Checking**: No ESLint, TypeScript, or static analysis tools are configured in the repository.
- **Production Consumer Context**: Upstream/downstream callers of this library were not available for evaluation.
