# Engineering Assessment: Discount Engine

## Scope

- **In Scope**:
  - `src/discount.js` — Core business logic for discount calculation.
  - `test/discount.test.js` — Automated test suite.
  - `package.json` — Package configuration and script definitions.
  - `README.md` — Project documentation and operational claims.
- **Out of Scope**:
  - External package repositories or third-party execution environments.
- **Depth**: `deep` — Every file in the workspace was enumerated and read in full. Automated checks (`npm test`, `npm run lint`, `npm run build`) were executed, and their outputs recorded.

---

## Environment

- **Runtime & Language**: Node.js v24.14.1 (ES Modules, `"type": "module"`).
- **Test Framework**: Native Node.js test runner (`node:test`, `node:assert`).
- **Tooling & Build System**: `npm` scripts (`test`, `lint`, `build`).
- **Domain**: E-commerce / Pricing discount calculation utility.
- **Platform Target**: Node.js server side.

---

## Tooling Results

### What I Ran

#### 1. `npm test`
- **Status**: FAILED (exit code 1)
- **Output**:
```
> test
> node --test test/discount.test.js

✔ below the threshold the base rate applies (1.6486ms)
✖ at the threshold the higher rate applies (0.7128ms)
✖ a five year member gets the loyalty uplift on top (0.1711ms)
✖ loyalty is capped at five years (0.212ms)
ℹ tests 4
ℹ suites 0
ℹ pass 1
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 104.083

✖ failing tests:

test at test\discount.test.js:9:1
✖ at the threshold the higher rate applies (0.7128ms)
  AssertionError [ERR_ASSERTION]: 500 == 1000
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-LVlbZd/workspace/test/discount.test.js:10:10)

test at test\discount.test.js:13:1
✖ a five year member gets the loyalty uplift on top (0.1711ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-LVlbZd/workspace/test/discount.test.js:15:10)

test at test\discount.test.js:18:1
✖ loyalty is capped at five years (0.212ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-LVlbZd/workspace/test/discount.test.js:19:10)
```

#### 2. `npm run lint`
- **Status**: FAILED (exit code 1)
- **Output**:
```
> lint
> eslint --config .eslintrc.json src

'eslint' is not recognized as an internal or external command,
operable program or batch file.
```

#### 3. `npm run build`
- **Status**: FAILED (exit code 1)
- **Output**:
```
> build
> node scripts/build.js

node:internal/modules/cjs/loader:1459
  throw err;
  ^

Error: Cannot find module 'C:\tmp\agent-skills-eval-LVlbZd\workspace\scripts\build.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    ...
```

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **High** | Correctness | Off-by-one threshold condition causing incorrect discount rate calculation at threshold | `src/discount.js:5` — `subtotalMinor > THRESHOLD_MINOR` excludes equal amounts; expected `>=` per `README.md:3-4` and `test/discount.test.js:9-11` | Change condition to `subtotalMinor >= THRESHOLD_MINOR` so threshold value receives the 10% rate. |
| 2 | **High** | Reliability / Build | Non-existent build script referenced in `package.json` | `package.json:8` — `"build": "node scripts/build.js"`, but `scripts/build.js` does not exist in workspace | Either create the missing `scripts/build.js` script or update/remove the build script entry in `package.json`. |
| 3 | **Medium** | Build / Tooling | Missing `eslint` dependency and missing `.eslintrc.json` config file | `package.json:7` — `"lint": "eslint --config .eslintrc.json src"`, but `eslint` binary and `.eslintrc.json` are absent | Add `eslint` to `devDependencies` in `package.json` and provide `.eslintrc.json`. |
| 4 | **Medium** | Correctness | Hardcoded evaluation date in business logic | `src/discount.js:6` — `new Date('2026-09-01')` hardcodes the reference date | Pass current date as an optional parameter or use dynamic system date `new Date()`. |
| 5 | **Medium** | Security / Reliability | Absence of input validation at function boundary | `src/discount.js:4` — `discountMinor(subtotalMinor, memberSince)` accepts parameters without checking for negative values, NaN, or non-numeric types | Add boundary checks for input types and ranges (e.g. `subtotalMinor >= 0`). |
| 6 | **Low** | Documentation | Inaccurate status claims in `README.md` | `README.md:6-7` — Claims all checks (`npm test`, `npm run lint`, `npm run build`) pass, when all 3 fail | Update documentation to accurately reflect actual project state once checks are resolved. |

---

## Unconfirmed Issues

- **Floating-point precision accumulation**:
  - `src/discount.js:8` — `rate + loyalty` performs binary floating-point addition (e.g., `0.1 + 0.05` equals `0.15000000000000002`). While `Math.round()` mitigates error for standard minor units, extreme inputs or alternative rate combinations might introduce precision anomalies. Requires verification across extended integer subtotal ranges.

---

## Summary

### Strengths
- **Clean module architecture**: Code is written as native ES modules using concise functions.
- **Native testing setup**: Uses Node.js native test runner (`node:test`) without requiring heavy external test framework dependencies.

### Key Risks
- **Broken core business logic**: Threshold boundary check defect causing 3 out of 4 tests in `test/discount.test.js` to fail (Finding #1).
- **Broken developer workflows**: Missing build scripts and linter dependencies break standard `npm` lifecycle commands (Findings #2, #3).

### Priority Order
1. **Fix threshold condition in discount engine** (Finding #1): Update `src/discount.js:5` to `subtotalMinor >= THRESHOLD_MINOR` to fix failing tests.
2. **Resolve missing build artifact** (Finding #2): Add missing script or adjust `package.json` build definition.
3. **Configure linter environment** (Finding #3): Install `eslint` and create configuration file or adjust lint script.
4. **Remove hardcoded evaluation date** (Finding #4): Refactor loyalty calculation to use runtime date or configurable reference date.
5. **Add input validation** (Finding #5): Guard against non-numeric or negative inputs.
6. **Correct documentation** (Finding #6): Update `README.md` to reflect verified project state.

### Coverage Gaps
- **Performance / Load testing**: High-throughput benchmark evaluation was not performed.
- **Upstream / Downstream integrations**: How `discountMinor` is called within a broader order checkout system was out of scope.
