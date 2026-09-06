# Engineering Assessment: Discount Engine

## 1. Scope

- **In Scope**:
  - `src/discount.js`: Tiered discount logic implementation.
  - `test/discount.test.js`: Unit test suite.
  - `package.json`: Project manifest, scripts, and dependencies.
  - `README.md`: Project documentation and specified requirements.
- **Out of Scope**:
  - External package registries or external CI/CD pipelines.
- **Depth**:
  - `deep`: Full line-by-line code examination of all workspace files, plus execution of all declared npm scripts (`test`, `lint`, `build`).

---

## 2. Environment

- **Language & Runtime**: JavaScript (Node.js v24.14.1, ES Modules format `type: "module"`).
- **Test Framework**: Native Node.js test runner (`node:test`, `node:assert`).
- **Build & Tooling Systems**: npm (`npm test`, `npm run lint`, `npm run build`).

---

## 3. Tooling Results (What I ran)

Every command declared in `package.json` was executed. The exact commands and outcomes are recorded below:

### `npm test`
- **Command**: `npm test` (`node --test test/discount.test.js`)
- **Exit Code**: `1` (Failed)
- **Output**:
  ```text
  ✔ below the threshold the base rate applies (2.0881ms)
  ✖ at the threshold the higher rate applies (0.6482ms)
  ✖ a five year member gets the loyalty uplift on top (0.1681ms)
  ✖ loyalty is capped at five years (0.1655ms)
  ℹ tests 4 | pass 1 | fail 3
  
  Failing assertions:
  - test at test/discount.test.js:9:1: AssertionError [ERR_ASSERTION]: 500 == 1000
  - test at test/discount.test.js:13:1: AssertionError [ERR_ASSERTION]: 1000 == 1500
  - test at test/discount.test.js:18:1: AssertionError [ERR_ASSERTION]: 1000 == 1500
  ```

### `npm run lint`
- **Command**: `npm run lint` (`eslint --config .eslintrc.json src`)
- **Exit Code**: `1` (Failed)
- **Output**:
  ```text
  'eslint' is not recognized as an internal or external command,
  operable program or batch file.
  ```
- **Reason**: `eslint` is not installed as a local or global dependency, and `.eslintrc.json` is missing from the repository.

### `npm run build`
- **Command**: `npm run build` (`node scripts/build.js`)
- **Exit Code**: `1` (Failed)
- **Output**:
  ```text
  Error: Cannot find module 'C:\tmp\agent-skills-eval-dXWKNY\workspace\scripts\build.js'
      at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
  ```
- **Reason**: `scripts/build.js` does not exist in the repository.

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | High | Correctness | Off-by-one error at threshold boundary (`>` instead of `>=`). | [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/src/discount.js#L5) — `subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05` | Change boundary check to `subtotalMinor >= THRESHOLD_MINOR` to apply the 10% rate at the threshold as specified in [`README.md:3-4`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/README.md#L3-L4). |
| 2 | High | Reliability | Missing build script reference (`scripts/build.js`). | [`package.json:8`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/package.json#L8) — `"build": "node scripts/build.js"` fails with `MODULE_NOT_FOUND`. | Create `scripts/build.js` or update/remove the `build` script entry in `package.json`. |
| 3 | High | Maintainability | Broken lint script and missing dev dependency. | [`package.json:7`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/package.json#L7) — `eslint` command fails due to missing executable and missing `.eslintrc.json`. | Add `eslint` to `devDependencies`, add `.eslintrc.json` configuration, and run `npm install`. |
| 4 | Medium | Correctness | Hardcoded year reference (`'2026-09-01'`) for loyalty calculation. | [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/src/discount.js#L6) — `new Date('2026-09-01').getFullYear() - memberSince` | Pass the current date/year dynamically or as an optional parameter to avoid locking calculations to 2026. |
| 5 | Medium | Maintainability | Inaccurate claim in `README.md` regarding test/lint/build status. | [`README.md:6-7`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/README.md#L6-L7) claims all checks pass green, but `npm test`, `npm run lint`, and `npm run build` all fail. | Update documentation to accurately reflect actual script status after resolving issues. |
| 6 | Low | Robustness | Lack of input validation for `subtotalMinor` and `memberSince`. | [`src/discount.js:4-8`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/src/discount.js#L4-L8) accepts negative numbers, non-integers, or invalid dates without throwing errors or handling edge cases. | Add basic guard clauses validating that `subtotalMinor >= 0` and `memberSince` is a valid past year. |

---

## 5. Unconfirmed Issues

- **Floating-point precision rounding**:
  - *Observation*: Adding floating point numbers like `0.1 + 0.05` yields `0.15000000000000002`. While `Math.round()` mitigates this for integer minor units, sub-cent calculations or unusual inputs could exhibit floating point drift.
  - *Investigation needed*: Verify if subtotal amounts require integer arithmetic throughout or explicit cent-based fixed point math.

---

## 6. Summary

### Strengths
- **Clean modular structure**: Uses standard ES Modules (`import`/`export`) and native Node.js test runner without extra runtime dependencies.
- **Clear unit test assertions**: Test cases in `test/discount.test.js` accurately articulate expected business rules (e.g., threshold rate switch and 5-year loyalty cap).

### Key Risks
- **Financial calculation defect**: Incorrect comparison operator (`>`) causes purchases exactly at `10_000` minor units to receive 5% discount instead of 10% (Finding #1).
- **Broken CI/build chain**: All three npm commands (`test`, `lint`, `build`) fail during execution, preventing automated quality gates (Findings #2, #3).

### Priority Order
1. **Fix threshold logic**: Update [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/src/discount.js#L5) to `subtotalMinor >= THRESHOLD_MINOR`.
2. **Fix build & lint tooling**: Either implement `scripts/build.js` and setup `eslint` with configuration, or clean up `package.json` scripts.
3. **Refactor hardcoded dates**: Make reference date dynamic or configurable in [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-dXWKNY/workspace/src/discount.js#L6).
4. **Update README.md**: Correct documentation once all commands run green.

### Coverage Gaps
- **Performance / Load testing**: No benchmarking was performed.
- **Security audit**: Dependencies were not checked via `npm audit` as `package-lock.json` and `node_modules` are not present.
