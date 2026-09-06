# Engineering Assessment: Discount Engine

## Scope

- **In scope**: `src/discount.js`, `test/discount.test.js`, `package.json`, `README.md`.
- **Out of scope**: External API integrations, database persistence, authorization/authentication layers (none present).
- **Depth**: `deep` — every file in the repository read in full; all declared project commands executed and outputs recorded.

---

## Environment

- **Language & Runtime**: JavaScript (Node.js v24.14.1, ES Modules)
- **Test Framework**: `node:test` (Node.js native test runner)
- **Package Manager & Tooling**: `npm` (`test`, `lint`, `build` scripts)

---

## Tooling Results (What I Ran)

### 1. `npm test`
- **Command**: `npm test`
- **Exit Code**: `1`
- **Output**:
  ```text
  > test
  > node --test test/discount.test.js

  ✔ below the threshold the base rate applies (2.0321ms)
  ✖ at the threshold the higher rate applies (0.6684ms)
  ✖ a five year member gets the loyalty uplift on top (0.1694ms)
  ✖ loyalty is capped at five years (0.1828ms)
  ℹ tests 4
  ℹ suites 0
  ℹ pass 1
  ℹ fail 3
  ℹ cancelled 0
  ℹ skipped 0
  ℹ todo 0
  ℹ duration_ms 122.8353

  ✖ failing tests:

  test at test\discount.test.js:9:1
  ✖ at the threshold the higher rate applies (0.6684ms)
    AssertionError [ERR_ASSERTION]: 500 == 1000
        at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/test/discount.test.js:10:10)

  test at test\discount.test.js:13:1
  ✖ a five year member gets the loyalty uplift on top (0.1694ms)
    AssertionError [ERR_ASSERTION]: 1000 == 1500
        at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/test/discount.test.js:15:10)

  test at test\discount.test.js:18:1
  ✖ loyalty is capped at five years (0.1828ms)
    AssertionError [ERR_ASSERTION]: 1000 == 1500
        at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/test/discount.test.js:19:10)
  ```

### 2. `npm run lint`
- **Command**: `npm run lint`
- **Exit Code**: `1`
- **Output**:
  ```text
  > lint
  > eslint --config .eslintrc.json src

  'eslint' is not recognized as an internal or external command,
  operable program or batch file.
  ```

### 3. `npm run build`
- **Command**: `npm run build`
- **Exit Code**: `1`
- **Output**:
  ```text
  > build
  > node scripts/build.js

  node:internal/modules/cjs/loader:1459
    throw err;
    ^

  Error: Cannot find module 'C:\tmp\agent-skills-eval-y4VW2K\workspace\scripts\build.js'
  ```

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **High** | Correctness | Off-by-one boundary check causes incorrect discount calculation at threshold. | [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/src/discount.js#L5) — `subtotalMinor > THRESHOLD_MINOR` evaluates `10000 > 10000` to `false`. | Change comparison operator from `>` to `>=` so subtotals at threshold receive 10% rate. |
| 2 | **High** | Reliability | `lint` and `build` scripts fail immediately upon execution. | [`package.json:7-8`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/package.json#L7-L8) — `eslint` missing from environment; `scripts/build.js` file does not exist. | Add required dependencies to `devDependencies` or remove non-existent script tasks. |
| 3 | **Medium** | Maintainability | Documentation in `README.md` makes false claims regarding project build/test status. | [`README.md:6-7`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/README.md#L6-L7) — Claims `npm test`, `npm run lint`, `npm run build` are all green. | Update `README.md` to reflect actual build and test suite status after fixing issues. |
| 4 | **Medium** | Architecture | Hardcoded current date limits testability and breaks calculations over time. | [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/src/discount.js#L6) — `new Date('2026-09-01')` hardcodes reference point. | Pass reference date/year as an optional parameter or inject time provider service. |
| 5 | **Medium** | Security / Reliability | Absence of input validation at trust boundary for inputs. | [`src/discount.js:4-8`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/src/discount.js#L4-L8) — No checks for negative subtotal, non-number inputs, or future member dates. | Add guard clauses validating `subtotalMinor >= 0` and `memberSince` ranges. |
| 6 | **Low** | Correctness | Floating point precision addition prior to rounding. | [`src/discount.js:8`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/src/discount.js#L8) — `rate + loyalty` produces floats like `0.15000000000000002`. | Compute discount components or convert to integer minor units directly before addition. |

---

## Unconfirmed Issues

- **Behavior on non-integer year input**: If `memberSince` is passed as a full timestamp or `Date` object instead of a 4-digit integer year, `getFullYear()` logic will fail or return `NaN`.

---

## Summary

### Strengths
1. **Lightweight execution model**: Uses native Node.js ES Modules (`"type": "module"`) without external runtime compilation dependencies.
2. **Standard test structure**: Utilizes Node's built-in `node:test` runner (`test/discount.test.js`), requiring zero external testing framework dependencies for unit tests.

### Key Risks
- **Business logic failure**: 3 out of 4 unit tests fail (`npm test` exits with code 1) due to the threshold operator bug (Finding #1).
- **Broken build & tooling pipeline**: Both `npm run lint` and `npm run build` fail due to missing dependencies and missing target files (Finding #2).

### Priority Order
1. Fix comparison logic in [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/src/discount.js#L5) (`>=` instead of `>`).
2. Fix broken script definitions in [`package.json`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/package.json#L7-L8) or create `scripts/build.js` / configure `eslint`.
3. Add input validation for `subtotalMinor` and `memberSince` parameters in [`src/discount.js`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/src/discount.js#L4).
4. Parametrize reference date in [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/src/discount.js#L6).
5. Update [`README.md`](file:///C:/tmp/agent-skills-eval-y4VW2K/workspace/README.md#L6-L7) documentation.

### Coverage Gaps
- **Out-of-scope files**: None (100% of workspace files were examined).
- **Tooling gaps**: Static linting (`eslint`) could not be executed due to missing binary.
- **Testing gaps**: Edge cases for invalid/malformed inputs (negative numbers, strings, nulls, future dates) were not tested in the existing test suite.
