# Engineering Assessment: Discount Engine

## 1. Scope

- **In Scope**: All files in the repository:
  - `package.json`
  - `README.md`
  - `src/discount.js`
  - `test/discount.test.js`
- **Out of Scope**: External integrations, deployment pipelines, upstream cart services.
- **Assessment Depth**: `targeted` (Every file in the workspace was opened and read in full; all declared project scripts were executed).

---

## 2. Environment

- **Language & Runtime**: JavaScript (ES Modules, Node.js `v24.14.1`)
- **Test Runner**: Native Node.js Test Runner (`node:test`)
- **Build & Lint Tooling**: `npm` scripts calling `eslint` and `node scripts/build.js`
- **Domain**: E-commerce discount calculation engine

---

## 3. Tooling Results

### What I Ran

| Command | Status | Output Summary |
| --- | --- | --- |
| `npm test` | **FAILED** (exit code 1) | Ran `node --test test/discount.test.js`. 1 test passed, 3 failed. Failures in threshold detection and loyalty calculation tests. |
| `npm run lint` | **FAILED** (exit code 1) | `'eslint' is not recognized as an internal or external command`. Dependency missing from `package.json`. |
| `npm run build` | **FAILED** (exit code 1) | `Error: Cannot find module '.../scripts/build.js'`. Script file does not exist. |

#### Detailed Command Logs

```
$ npm test
> node --test test/discount.test.js

✔ below the threshold the base rate applies (2.7629ms)
✖ at the threshold the higher rate applies (3.4757ms)
✖ a five year member gets the loyalty uplift on top (0.6128ms)
✖ loyalty is capped at five years (0.2798ms)

AssertionError [ERR_ASSERTION]: 500 == 1000
    at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-CMFtl0/workspace/test/discount.test.js:10:10)
```

```
$ npm run lint
> eslint --config .eslintrc.json src

'eslint' is not recognized as an internal or external command...
```

```
$ npm run build
> node scripts/build.js

Error: Cannot find module 'C:\tmp\agent-skills-eval-CMFtl0\workspace\scripts\build.js'
```

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **High** | Correctness | Off-by-one boundary check: Strict greater-than (`>`) used instead of greater-than-or-equal (`>=`) for discount threshold. Orders at exactly 10,000 minor units receive 5% discount instead of 10%. | `src/discount.js:5` | Change `subtotalMinor > THRESHOLD_MINOR` to `subtotalMinor >= THRESHOLD_MINOR`. |
| 2 | **High** | Reliability | Broken build and lint scripts: `npm run lint` fails due to missing `eslint` dependency; `npm run build` fails because `scripts/build.js` does not exist. | `package.json:7-8` | Install `eslint` in `devDependencies` and create `scripts/build.js` (or remove broken scripts). |
| 3 | **Medium** | Documentation | False claims in README: Document asserts all checks (`npm test`, `npm run lint`, `npm run build`) pass on every commit, when all three fail. | `README.md:6-7` | Update `README.md` to reflect actual build status and requirements. |
| 4 | **Medium** | Reliability | Fixed reference date for loyalty calculation: `new Date('2026-09-01')` hardcodes the evaluation year and produces incorrect or negative loyalty for future `memberSince` values. | `src/discount.js:6` | Use `new Date().getFullYear()` or pass the reference date dynamically, and clamp `years` to `>= 0`. |
| 5 | **Medium** | Correctness | Missing input validation: No guards against negative subtotals, non-numeric values, or invalid years. | `src/discount.js:4` | Add boundary validations for `subtotalMinor` (must be non-negative integer) and `memberSince`. |
| 6 | **Low** | Correctness | Floating-point arithmetic precision: Adding rates directly (`0.1 + 0.05`) relies on IEEE-754 floats before rounding. | `src/discount.js:7-8` | Compute percentages using integer basis points (e.g. 500 bp = 5%, 1000 bp = 10%) before dividing. |
| 7 | **Info** | Maintainability | Native testing setup: Uses built-in `node:test` runner avoiding heavy external test framework dependencies. | `test/discount.test.js:1-21` | Retain `node:test` pattern and expand test cases for edge conditions. |

---

## 5. Unconfirmed Issues

- **Date Format Assumption**: `memberSince` is assumed to be a 4-digit calendar year integer. If callers pass ISO strings or `Date` instances, `getFullYear() - memberSince` evaluates to `NaN`.

---

## 6. Summary

### Strengths
1. **Zero Runtime Dependencies**: The codebase relies strictly on standard Node.js ES modules.
2. **Native Test Runner**: Tests use `node:test` and `node:assert`, providing fast execution without external test harness overhead.

### Key Risks
- **Revenue Impact**: Orders at the threshold are charged incorrect higher amounts (or given lower discounts than promised), violating business rules (Finding #1).
- **CI/CD Failure**: Automated scripts (`npm test`, `npm run lint`, `npm run build`) fail completely (Finding #2).
- **Misleading Documentation**: System documentation claims green builds when all tests and commands are red (Finding #3).

### Priority Order
1. **Fix Threshold Logic**: Modify `src/discount.js:5` to use `>=`.
2. **Fix Build & Lint Script Configuration**: Add missing `scripts/build.js` and install/configure ESLint in `package.json`.
3. **Refactor Date & Loyalty Calculations**: Replace hardcoded date in `src/discount.js:6` with dynamic year handling and input sanitization.
4. **Correct README.md**: Update documentation to accurately describe test and build status.

### Coverage Gaps
- **Load / Concurrency Testing**: No performance benchmarks under high throughput.
- **Currency Support**: Only minor currency units tested; multi-currency rounding rules not assessed.
- **Security Audit**: Codebase is small, but no static security analysis tool (e.g., CodeQL, Snyk) was run.
