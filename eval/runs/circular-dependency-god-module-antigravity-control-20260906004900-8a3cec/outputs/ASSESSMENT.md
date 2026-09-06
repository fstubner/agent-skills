# Engineering Assessment: `orders-core`

Assessment of the `orders-core` package prior to extracting it for reuse across systems.

---

## 1. Scope

- **In scope**:
  - All source files under `src/`: [`src/customers.js`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/customers.js), [`src/pricing.js`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/pricing.js), [`src/util.js`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js)
  - All test files under `test/`: [`test/pricing.test.js`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/test/pricing.test.js)
  - Package manifest and configuration: [`package.json`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/package.json), [`README.md`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/README.md)
- **Out of scope**:
  - Downstream applications or external services consuming `orders-core`
  - Database layers or deployment pipelines
- **Assessment Depth**: `targeted` (every file in the repository was read in full, and the project test suite executed)

---

## 2. Environment

- **Language / Runtime**: JavaScript (Node.js ES Modules)
- **Node.js Environment**: Node.js with native ES Module support (`"type": "module"` in `package.json`)
- **Frameworks & Dependencies**: Native `node:test` runner; zero external dependencies in `package.json`
- **Build System & Tooling**: `npm test` script invoking `node --test test/pricing.test.js`

---

## 3. Tooling Results

### What I Ran

#### 1. `npm test`
- **Command**: `npm test` (`node --test test/pricing.test.js`)
- **Status**: PASSED (Exit code 0)
- **Output**:
  ```text
  > test
  > node --test test/pricing.test.js

  ✔ a weekday order has no surcharge (1.2255ms)
  ✔ a weekend order carries the surcharge (0.1767ms)
  ℹ tests 2
  ℹ suites 0
  ℹ pass 2
  ℹ fail 0
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 232.4001
  ```

#### 2. `npm audit`
- **Command**: `npm audit`
- **Status**: FAILED (Exit code 1)
- **Output**:
  ```text
  npm error code ENOLOCK
  npm error audit This command requires an existing lockfile.
  ```
  *(Reason: `package-lock.json` is not present in the workspace. No external packages are installed.)*

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | High | Architecture | Circular module dependency between `util.js`, `customers.js`, and `pricing.js` | [`src/customers.js:1`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/customers.js#L1) imports `slugify` from `./util.js`, [`src/pricing.js:1`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/pricing.js#L1) imports `isWeekend` from `./util.js`, while [`src/util.js:2-3`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L2-L3) imports `findCustomer` and `priceFor`. | Extract pure utilities (`slugify`, `isWeekend`, `formatMoney`, `chunk`, `retry`) into a base helper module with no domain dependencies. |
| 2 | High | Reliability | Infinite loop in `chunk` when `size <= 0` | [`src/util.js:31`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L31) increments loop counter via `i += size`. If `size <= 0`, `i` never advances, locking the CPU loop. | Add parameter validation in `chunk` ([`src/util.js:29`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L29)) to throw a `RangeError` when `size <= 0`. |
| 3 | Medium | Correctness | `retry` throws `undefined` when `times <= 0` | [`src/util.js:35-41`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L35-L41) executes `0` loop iterations when `times <= 0`. Line 40 then executes `throw last;` while `last` is `undefined`. | Validate `times > 0` at entry in [`src/util.js:35`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L35) and throw an explicit `RangeError`. |
| 4 | Medium | Correctness | Broken formatting for negative amounts in `formatMoney` | [`src/util.js:6`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L6) evaluates `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`. For `minor = -50`, output is `"-1.-50"`. | Format negative numbers correctly by taking absolute values for dollar/cent components and prefixing `-`. |
| 5 | Medium | Maintainability | Severely incomplete test suite | Only [`test/pricing.test.js`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/test/pricing.test.js) exists (2 tests for `priceFor`). Functions in `customers.js` and 7 of 8 functions in `util.js` have 0 tests. | Add unit test files (e.g., `test/util.test.js`, `test/customers.test.js`) covering all exported functions and edge cases before extracting the package. |
| 6 | Low | Architecture | Hardcoded customer array in `customers.js` | [`src/customers.js:3-6`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/customers.js#L3-L6) hardcodes `CUSTOMERS` with only two static records. | Provide a repository or registry injection mechanism for customers if this package is intended for reuse across different domains. |
| 7 | Low | Reliability | Unvalidated string splitting in `parseDate` | [`src/util.js:19`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L19) executes `value.split('-').map(Number)` without checking string structure, returning `NaN` for invalid dates. | Validate string formatting prior to parsing in [`src/util.js:18`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L18). |

---

## 5. Unconfirmed Issues

- **ISO Date Offset Parsing**: `parseDate` in [`src/util.js:18`](file:///C:/tmp/agent-skills-eval-gM8vfQ/workspace/src/util.js#L18) splits input string on `-`. If caller applications pass ISO 8601 timestamps containing local time offsets (e.g. `2026-09-05T23:00:00-05:00`), `split('-')` will split unexpectedly and fail. Requires confirming input contract expectations with consumers.

---

## 6. Summary

### Strengths
1. **Zero Production Dependencies**: Clean ES module package using Node's built-in `node:test` runner.
2. **Pure Functional Components**: Core mathematical logic (e.g. `priceFor`, `slugify`) uses pure functions without hidden side effects.

### Key Risks
- **Module Dependency Cycles (Finding #1)**: Imports between `util.js`, `customers.js`, and `pricing.js` form a cycle, making module resolution fragile when extracted.
- **Unbounded Loops & Error Bugs (Findings #2, #3, #4)**: Edge cases in `util.js` functions (`chunk`, `retry`, `formatMoney`) cause runtime CPU hangs, throwing `undefined`, or returning corrupted currency strings.
- **Untested Surface (Finding #5)**: Over 80% of exports lack unit tests.

### Priority Order
1. **Break Circular Module Dependencies (Finding #1)**: Move generic helper functions into a standalone utility module free of domain imports.
2. **Fix Helper Edge Case Defects (Findings #2, #3, #4)**: Add input validation to `chunk` and `retry`, and fix negative number rendering in `formatMoney`.
3. **Expand Test Suite (Finding #5)**: Add test coverage for `customers.js` and all functions in `util.js`.
4. **Harden Data Handling (Findings #6, #7)**: Decouple customer storage and add input validation in `parseDate`.

### Coverage Gaps
- **Performance & Load**: No benchmarking executed.
- **Consumer Compatibility**: No downstream applications available to verify consumer import patterns.
