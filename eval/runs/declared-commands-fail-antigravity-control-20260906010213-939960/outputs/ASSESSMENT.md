# Engineering Assessment: Discount Engine

## 1. Scope
- **In Scope**:
  - `src/discount.js` — Core discount calculation logic.
  - `test/discount.test.js` — Unit test suite.
  - `package.json` — Script and dependency definitions.
  - `README.md` — Project documentation.
- **Out of Scope**:
  - CI/CD workflows, deployment infrastructure, or external integrations (none present in the repository).
- **Depth**: `targeted` (every file in the workspace was enumerated and read in full).

## 2. Environment
- **Languages & Runtimes**: JavaScript (Node.js ES Modules, Node.js v24.14.1).
- **Frameworks & Libraries**: Node native test runner (`node:test`, `node:assert`).
- **Domain**: Pricing / Discount Engine module.
- **Platform**: Node.js runtime / backend library.
- **Build Systems & Tooling**: npm.

## 3. Tooling Results

### What I Ran

#### 1. `npm test`
- **Command**: `npm test`
- **Exit Code**: `1`
- **Output**:
```
> test
> node --test test/discount.test.js

✔ below the threshold the base rate applies (1.6813ms)
✖ at the threshold the higher rate applies (0.8238ms)
✖ a five year member gets the loyalty uplift on top (0.2203ms)
✖ loyalty is capped at five years (0.2188ms)
ℹ tests 4
ℹ suites 0
ℹ pass 1
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 127.0882

✖ failing tests:

test at test\discount.test.js:9:1
✖ at the threshold the higher rate applies (0.8238ms)
  AssertionError [ERR_ASSERTION]: 500 == 1000
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/test/discount.test.js:10:10)
      at Test.runInAsyncScope (node:async_hooks:228:14)
      at Test.run (node:internal/test_runner/test:1118:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:787:18)
      at Test.postRun (node:internal/test_runner/test:1247:19)
      at Test.run (node:internal/test_runner/test:1175:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:358:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 500,
    expected: 1000,
    operator: '==',
    diff: 'simple'
  }

test at test\discount.test.js:13:1
✖ a five year member gets the loyalty uplift on top (0.2203ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/test/discount.test.js:15:10)
      at Test.runInAsyncScope (node:async_hooks:228:14)
      at Test.run (node:internal/test_runner/test:1118:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:787:18)
      at Test.postRun (node:internal/test_runner/test:1247:19)
      at Test.run (node:internal/test_runner/test:1175:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 1000,
    expected: 1500,
    operator: '==',
    diff: 'simple'
  }

test at test\discount.test.js:18:1
✖ loyalty is capped at five years (0.2188ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/test/discount.test.js:19:10)
      at Test.runInAsyncScope (node:async_hooks:228:14)
      at Test.run (node:internal/test_runner/test:1118:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:787:18)
      at Test.postRun (node:internal/test_runner/test:1247:19)
      at Test.run (node:internal/test_runner/test:1175:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:787:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 1000,
    expected: 1500,
    operator: '==',
    diff: 'simple'
  }
```

#### 2. `npm run lint`
- **Command**: `npm run lint`
- **Exit Code**: `1`
- **Output**:
```
> lint
> eslint --config .eslintrc.json src

'eslint' is not recognized as an internal or external command,
operable program or batch file.
```

#### 3. `npm run build`
- **Command**: `npm run build`
- **Exit Code**: `1`
- **Output**:
```
> build
> node scripts/build.js

node:internal/modules/cjs/loader:1459
  throw err;
  ^

Error: Cannot find module 'C:\tmp\agent-skills-eval-eYDI0s\workspace\scripts\build.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1066:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1071:22)
    at Module._load (node:internal/modules/cjs/loader:1242:25)
    at wrapModuleLoad (node:internal/modules/cjs/loader:255:19)
    at Module.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:154:5)
    at node:internal/main/run_main_module:33:47 {
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}

Node.js v24.14.1
```

### Tool Execution Status Summary
- **Tools Run Successfully**: `node --test` (executed unit tests, 1 passed, 3 failed).
- **Tools Executed with Failure**: `npm test` (3/4 failing tests), `npm run lint` (command missing), `npm run build` (script missing).
- **Tools Unavailable**: ESLint (not installed in `devDependencies`).

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | High | Correctness | Boundary comparison logic bug uses strict inequality `>` instead of `>=` | `src/discount.js:5` — `subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05` causes test failures at `test/discount.test.js:10,15,19` where a subtotal of 10000 receives 5% base rate instead of 10%. | Update `src/discount.js:5` to `subtotalMinor >= THRESHOLD_MINOR`. |
| 2 | Medium | Maintainability | Hardcoded reference date `'2026-09-01'` for member tenure calculation | `src/discount.js:6` — `new Date('2026-09-01').getFullYear()` hardcodes reference year, making tenure calculations static over time. | Allow reference date or current date to be supplied dynamically (e.g., `(asOfDate || new Date()).getFullYear()`). |
| 3 | Medium | Data Integrity | Lack of input validation for negative subtotals, non-numeric types, or future membership years | `src/discount.js:4-8` — `discountMinor` performs arithmetic without checking inputs. Submitting future `memberSince` years (e.g., 2027) yields negative loyalty additions. | Add boundary assertions or type checks for `subtotalMinor >= 0` and `memberSince <= currentYear`. |
| 4 | Medium | Build & Tooling | NPM scripts `lint` and `build` fail due to missing dependencies and script files | `package.json:7-8` — `npm run lint` invokes missing `eslint` executable and missing `.eslintrc.json`; `npm run build` invokes non-existent `scripts/build.js`. | Install `eslint`, create `.eslintrc.json` and `scripts/build.js`, or remove broken script targets from `package.json`. |
| 5 | Medium | Reliability | Incomplete unit test suite | `test/discount.test.js:1-21` — Contains only 4 test cases; omits tests for subtotals strictly above threshold, 1-4 year loyalty tenures, zero subtotal, or invalid input edge cases. | Expand test coverage to include values above threshold (e.g. 10001), 1-4 year tenure tiers, zero subtotal, and invalid input cases. |
| 6 | Low | Documentation | False assertions in `README.md` concerning build and test status | `README.md:6-7` — Claims "All checks pass — `npm test`, `npm run lint` and `npm run build` are green on every commit" when all three commands fail. | Update `README.md` to reflect actual build status or fix underlying build/test failures. |

## 5. Unconfirmed Issues

- **Floating-point precision rounding**: `subtotalMinor * (rate + loyalty)` in `src/discount.js:8` uses standard JavaScript IEEE 754 floating-point arithmetic. While `Math.round()` handles simple integer subtotal test cases, complex minor-unit calculations should be monitored for precision edge cases.

## 6. Summary

### Strengths
- **Simple & Modular Codebase Structure**: `discountMinor` in [src/discount.js](file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/src/discount.js) is concise and leverages native ES module exports.
- **Zero Heavy Test Dependencies**: Uses Node's built-in `node:test` and `node:assert` modules without external testing libraries.

### Key Risks
- **Threshold Calculation Defect (Finding #1)**: Orders at exactly the 10,000 minor unit threshold receive only 5% base discount instead of 10%, causing 3 of 4 unit tests to fail.
- **Broken Tooling & False Documentation (Findings #4, #6)**: All three npm scripts fail, while documentation claims everything is passing.

### Priority Order
1. **Fix Threshold Comparison (Finding #1)**: Change `>` to `>=` in [src/discount.js:L5](file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/src/discount.js#L5) so threshold orders receive 10% discount and all tests pass.
2. **Parameterize Reference Date (Finding #2)**: Make the reference date configurable in [src/discount.js:L6](file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/src/discount.js#L6).
3. **Repair Tooling & Update README (Findings #4, #6)**: Fix or remove broken `lint` and `build` scripts in [package.json](file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/package.json) and correct status in [README.md](file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/README.md).
4. **Enforce Input Validation & Add Edge Case Tests (Findings #3, #5)**: Add defensive input checks and expand [test/discount.test.js](file:///C:/tmp/agent-skills-eval-eYDI0s/workspace/test/discount.test.js).

### Coverage Gaps
- **Linter & Static Analysis**: Could not execute ESLint because `eslint` and `.eslintrc.json` are missing.
- **Build Pipeline**: Could not run or assess build outputs because `scripts/build.js` is missing.
- **Integration Testing**: No shopping cart integration or multi-currency test suites exist in the workspace.
