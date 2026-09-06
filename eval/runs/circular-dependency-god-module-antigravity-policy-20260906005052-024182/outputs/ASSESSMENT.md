# Engineering Assessment: orders-core

## Scope

- **Target**: `orders-core` package located in workspace root (`C:\tmp\agent-skills-eval-nfj31h\workspace`).
- **Depth**: `deep` (every file in scope read in full; all declared project commands executed and reported).
- **In Scope**:
  - `package.json`
  - `README.md`
  - `src/customers.js`
  - `src/pricing.js`
  - `src/util.js`
  - `test/pricing.test.js`
- **Out of Scope**: External consumer applications (none present in workspace).

---

## Environment & Context

- **Language / Runtime**: JavaScript (Node.js ES Modules, `"type": "module"`).
- **Test Runner**: Node.js native test runner (`node --test`).
- **Dependencies**: 0 external dependencies.
- **Domain**: E-commerce order processing (pricing calculations, customer lookup, utility functions).
- **Platform Target**: Node.js runtime environment.

---

## Tooling Results & What I Ran

### 1. Test Suite Execution (`npm test`)

**Command:** `npm test`  
**Exit Code:** 0  
**Output:**
```
> test
> node --test test/pricing.test.js

✔ a weekday order has no surcharge (2.8971ms)
✔ a weekend order carries the surcharge (0.8144ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 376.8686
```

### 2. Unavailable / Non-existent Tooling

- **Build (`npm run build`)**: Not configured in `package.json`.
- **Type Checker (`tsc`)**: No TypeScript configuration or dependencies present.
- **Linter (`eslint`)**: No linter configured or installed.
- **Dependency Audit (`npm audit`)**: No external dependencies exist in `package.json`.

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **High** | Reliability | Infinite loop in `chunk(rows, size)` when `size <= 0` | [util.js:L29-L33](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/util.js#L29-L33) — `for (let i = 0; i < rows.length; i += size)` loops endlessly if `size <= 0`, causing process freeze. | Validate `size > 0` before looping; throw a `RangeError` if invalid. |
| 2 | **High** | Architecture | Tight circular dependencies between `util.js`, `customers.js`, and `pricing.js` | [customers.js:L1](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/customers.js#L1) imports `slugify` from `./util.js` while [util.js:L3](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/util.js#L3) imports `findCustomer` from `./customers.js`. [pricing.js:L1](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/pricing.js#L1) imports `isWeekend` from `./util.js` while [util.js:L2](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/util.js#L2) imports `priceFor` from `./pricing.js`. | Decouple pure utility functions (`slugify`, `isWeekend`, `parseDate`) into dedicated utility modules and remove domain-specific orchestrations (`describeOrder`) from generic `util.js`. |
| 3 | **Medium** | Correctness | Arithmetic bug in `formatMoney(minor)` for negative values | [util.js:L5-L7](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/util.js#L5-L7) — `Math.floor(-150 / 100)` yields `-2` and `-150 % 100` yields `-50`, returning `"-2.-50"` for `-150`. | Handle negative sign explicitly using absolute values (`Math.abs`) before formatting cents. |
| 4 | **Medium** | Reliability | `retry(fn, times)` throws `undefined` when `times <= 0` | [util.js:L35-L41](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/util.js#L35-L41) — `let last;` is uninitialized. If `times <= 0`, loop body never runs and `throw last` throws `undefined`. | Require `times >= 1` or throw an explicit `RangeError` / return error if invalid. |
| 5 | **Medium** | Maintainability / Testing | Complete lack of unit test coverage for `customers.js` and `util.js` | [pricing.test.js:L1-L12](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/test/pricing.test.js#L1-L12) only tests `priceFor`. `customers.js` and 7 out of 8 functions in `util.js` have 0 test assertions. | Add comprehensive unit tests for `formatMoney`, `describeOrder`, `slugify`, `parseDate`, `isWeekend`, `chunk`, `retry`, `findCustomer`, and `customerSlug`. |
| 6 | **Medium** | Boundary Validation | No input type or structure validation across public function boundaries | [pricing.js:L5-L8](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/pricing.js#L5-L8) (`priceFor`), [customers.js:L8-L10](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/customers.js#L8-L10) (`findCustomer`), [util.js:L18-L21](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/util.js#L18-L21) (`parseDate`) assume valid object inputs without checking for missing parameters, non-numeric values, or malformed strings. | Add explicit input parameter validation and bounds checking at public trust boundaries. |
| 7 | **Low** | Packaging | Package main entry point (`"main": "src/util.js"`) exposes an unorganized utility file directly | [package.json:L4](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/package.json#L4) sets `src/util.js` as `"main"`, pulling in domain models and circular dependencies on package import. | Create a clean `index.js` entry point that re-exports the public API cleanly. |

---

## Unconfirmed Issues / Requires Investigation

- **Async retry support**: `retry` in [util.js:L35-L41](file:///C:/tmp/agent-skills-eval-nfj31h/workspace/src/util.js#L35-L41) is strictly synchronous. If consumers pass async functions returning promises, `retry` will return the initial un-awaited promise rather than retrying rejections. Require product input on whether async retry support is needed for package reuse.

---

## Summary

### Strengths
- **Native ESM Setup**: Uses clean, standard Node.js ES Modules with no transpilation step required.
- **Fast Test Execution**: Native Node.js test runner (`node --test`) executes tests rapidly with zero external test framework dependencies.

### Key Risks
- **Process Hang Risk (Finding #1)**: Invoking `chunk(data, 0)` causes an infinite loop freezing the execution thread.
- **Circular Module Coupling (Finding #2)**: Deep cyclic dependencies between `util.js`, `customers.js`, and `pricing.js` make splitting out the package fragile and prone to initialization errors.
- **Formatting Defect (Finding #3)**: Negative monetary amounts format incorrectly (e.g. `"-2.-50"`).
- **Testing Blind Spots (Finding #5)**: Over 80% of module exports have zero automated tests.

### Priority Order for Refactoring
1. **Fix Infinite Loop Vulnerability**: Add `size > 0` validation to `chunk()` in `src/util.js`.
2. **Untangle Circular Dependencies**: Separate pure string/date/math utilities from domain order/customer orchestrators.
3. **Fix Formatting & Error Handling Bugs**: Repair `formatMoney` negative number formatting and `retry` zero-iteration behavior.
4. **Expand Automated Test Coverage**: Add unit tests for all exported functions in `src/util.js` and `src/customers.js` covering success and failure paths.
5. **Enforce Boundary Validation**: Add input sanitization and parameter checks for public API functions.
6. **Establish Clean Package API**: Create a root `index.js` re-exporting the public contract and update `package.json` `"main"`.

### Coverage Gaps
- **External Consumer Integration**: No consumer code was available in this workspace to assess real-world import patterns.
- **Asynchronous Workflows**: No async utility functions or integration tests exist in the codebase.
