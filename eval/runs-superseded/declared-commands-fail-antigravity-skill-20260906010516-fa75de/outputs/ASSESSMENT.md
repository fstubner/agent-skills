# Engineering Assessment: Discount Engine

## 1. Scope

- **In scope**:
  - `src/discount.js` — Main business logic for discount calculations.
  - `test/discount.test.js` — Unit test suite using Node.js test runner.
  - `package.json` — Package configuration and script definitions.
  - `README.md` — Project documentation and status claims.
- **Out of scope**: None (all files in the repository were enumerated and inspected).
- **Depth**: `deep` — Every file in the repository was read in full, all declared npm scripts were executed and recorded, and logic boundary checks were conducted against the specification in `README.md`.

---

## 2. Environment

- **Languages & Runtimes**: JavaScript (Node.js v24.14.1, ES Modules enabled via `"type": "module"` in `package.json`).
- **Frameworks & Libraries**: Node.js native test runner (`node:test`, `node:assert`). No external npm dependencies installed.
- **Domain**: E-commerce order discount calculation logic.
- **Platform Targets**: Node.js server runtime / backend module.
- **Build Systems & Tooling**: `npm` scripts (`test`, `lint`, `build`).

---

## 3. Tooling Results

### What I ran

#### Command 1: `npm test`
- **Exit Code**: 1
- **Status**: Failed (1 passed, 3 failed out of 4 tests)
- **Output**:
```
> test
> node --test test/discount.test.js

✔ below the threshold the base rate applies (7.8576ms)
✖ at the threshold the higher rate applies (1.8313ms)
✖ a five year member gets the loyalty uplift on top (1.6642ms)
✖ loyalty is capped at five years (1.2599ms)
ℹ tests 4
ℹ suites 0
ℹ pass 1
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 290.0627

✖ failing tests:

test at test\discount.test.js:9:1
✖ at the threshold the higher rate applies (1.8313ms)
  AssertionError [ERR_ASSERTION]: 500 == 1000
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/test/discount.test.js:10:10)

test at test\discount.test.js:13:1
✖ a five year member gets the loyalty uplift on top (1.6642ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/test/discount.test.js:15:10)

test at test\discount.test.js:18:1
✖ loyalty is capped at five years (1.2599ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/test/discount.test.js:19:10)
```

#### Command 2: `npm run lint`
- **Exit Code**: 1
- **Status**: Failed (`eslint` binary not found)
- **Output**:
```
> lint
> eslint --config .eslintrc.json src

'eslint' is not recognized as an internal or external command,
operable program or batch file.
```

#### Command 3: `npm run build`
- **Exit Code**: 1
- **Status**: Failed (`scripts/build.js` missing)
- **Output**:
```
> build
> node scripts/build.js

node:internal/modules/cjs/loader:1459
  throw err;
  ^

Error: Cannot find module 'C:\tmp\agent-skills-eval-dIDCPP\workspace\scripts\build.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    ...
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}
```

### Summary of Tool Execution
- **Executed & Failed**: `npm test` (ran unit tests, 3 assertions failed).
- **Tooling Execution Failures**: `npm run lint` (`eslint` missing), `npm run build` (`scripts/build.js` missing).
- **Unavailable Tools**: `eslint` binary is not installed globally or locally; `.eslintrc.json` is missing from repository root.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **High** | Correctness | Threshold logic uses strictly greater than (`>`) instead of greater than or equal (`>=`), causing orders at exact threshold to receive lower rate. | [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/src/discount.js#L5) — `subtotalMinor > THRESHOLD_MINOR` returns rate 0.05 instead of 0.1 at 10,000 minor units (`500 == 1000` assertion failure). | Change comparison operator on line 5 to `subtotalMinor >= THRESHOLD_MINOR`. |
| 2 | **Medium** | Documentation | `README.md` claims all checks (`npm test`, `npm run lint`, `npm run build`) pass green on every commit, which is false. | [`README.md:6-7`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/README.md#L6-L7) — `npm test` fails 3 tests, `npm run lint` missing `eslint`, `npm run build` missing `scripts/build.js`. | Update `README.md` status section once test, lint, and build configurations are resolved. |
| 3 | **Medium** | Tooling / Build | Build script defined in `package.json` points to non-existent file `scripts/build.js`. | [`package.json:8`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/package.json#L8) — `"build": "node scripts/build.js"` fails with `MODULE_NOT_FOUND`. | Create `scripts/build.js` or update `package.json` to reference valid build tooling. |
| 4 | **Medium** | Tooling / Lint | Lint script references `eslint` and `.eslintrc.json`, neither of which are installed or present. | [`package.json:7`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/package.json#L7) — `"lint": "eslint --config .eslintrc.json src"` fails because binary and config do not exist. | Add `eslint` as a dev dependency, create `.eslintrc.json`, or adjust lint script. |
| 5 | **Medium** | Correctness | Loyalty year calculation lacks a lower bound clamp (`Math.max(0, ...)`), allowing future `memberSince` years to reduce discount below base rate. | [`src/discount.js:6-7`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/src/discount.js#L6-L7) — `years = 2026 - memberSince` produces negative values if `memberSince > 2026`. | Wrap loyalty year calculation with `Math.max(0, Math.min(years, 5))`. |
| 6 | **Low** | Architecture | Reference date string (`'2026-09-01'`) is hardcoded inside function body rather than injected or parameterized. | [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/src/discount.js#L6) — `new Date('2026-09-01').getFullYear()` tightly couples function to a specific static year reference. | Allow reference date/year to be passed as an optional parameter (e.g., `referenceYear = new Date().getFullYear()`). |
| 7 | **Info** | Architecture | Standardized minor currency unit representation avoids floating point rounding errors during input handling. | [`src/discount.js:4`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/src/discount.js#L4) — Function takes `subtotalMinor` as input integer cents. | Retain integer minor currency representation across domain APIs. |
| 8 | **Info** | Testing | Test runner leverages native Node.js ES modules test runner with zero external test runner dependencies. | [`test/discount.test.js:1-3`](file:///C:/tmp/agent-skills-eval-dIDCPP/workspace/test/discount.test.js#L1-L3) — Uses `node:test` and `node:assert`. | Maintain native Node.js test runner structure for lightweight testing. |

---

## 5. Unconfirmed Issues

- **Rounding Specification for Half Cents**: `src/discount.js:8` uses standard JS `Math.round` (round half up towards $+\infty$). If business specification requires standard banker's rounding (round half to even) or explicit truncation, `Math.round` could produce off-by-1 minor unit variances on fractional cent thresholds. Requires confirmation of business financial spec.

---

## 6. Summary

### Strengths
1. **Lightweight Test Setup**: Uses Node.js native `node:test` runner, requiring no heavy external test framework dependencies.
2. **Safe Currency Units**: Operates on `subtotalMinor` (minor currency units / cents), preventing floating-point error accumulators before discount percentage application.

### Key Risks
1. **Broken Core Business Logic**: Threshold calculation logic fails for orders at $100.00 (10,000 minor units), causing 3 of 4 unit tests to fail (Finding 1).
2. **Broken CI & Tooling**: Every script command declared in `package.json` fails (`npm test`, `npm run lint`, `npm run build`), preventing automated verification (Findings 3 & 4).
3. **Misleading Documentation**: `README.md` inaccurately claims all automated checks pass on every commit (Finding 2).

### Priority Order
1. **Fix Threshold Comparison**: Update `src/discount.js:5` to `subtotalMinor >= THRESHOLD_MINOR` so threshold boundary logic matches specification and tests pass.
2. **Fix Build & Lint Script Setup**: Either create `scripts/build.js` and `.eslintrc.json` (installing `eslint`), or update `package.json` to accurately reflect project tooling.
3. **Fix Documentation**: Update `README.md` to reflect actual verified state of test and build execution.
4. **Harden Loyalty Calculation**: Add `Math.max(0, ...)` boundary check to prevent negative loyalty additions for future member dates.

### Coverage Gaps
1. **Performance/Load Testing**: Not performed (function is synchronous in-memory).
2. **Security Static Analysis**: No `npm audit` or SAST tools were available or run.
3. **External Dependencies**: `node_modules` was not populated; external dependency vulnerability checks could not be executed.
