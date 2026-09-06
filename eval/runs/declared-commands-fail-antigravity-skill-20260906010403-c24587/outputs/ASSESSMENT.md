# Engineering Assessment: Discount Engine

## Scope

- **In-Scope**:
  - `README.md`
  - `package.json`
  - `src/discount.js`
  - `test/discount.test.js`
- **Out-of-Scope**:
  - External CI/CD configuration (none present in repository).
  - Production deployment environments or consuming application code.
- **Depth**: `deep` — every file in the repository was read in full, all declared project build/test/lint commands were executed, and outputs were recorded.

---

## Environment

- **Languages & Runtimes**: JavaScript (Node.js v24.14.1, ES Modules format)
- **Frameworks & Libraries**: Node.js native test runner (`node:test`, `node:assert`)
- **Domain**: Pricing & Discount Engine
- **Platform Targets**: Node.js runtime / server-side JavaScript
- **Build Systems & Tooling**: npm scripts (`npm test`, `npm run lint`, `npm run build`)
- **Assessment Overlays & Standards**: `.agent-input/engineering-assessment/SKILL.md`, `references/severity-rubric.md`

---

## Tooling Results

### 1. `npm test`
- **Command**: `npm test` (`node --test test/discount.test.js`)
- **Status**: Failed (Exit code 1)
- **Output**:
```
> test
> node --test test/discount.test.js

✔ below the threshold the base rate applies (2.5239ms)
✖ at the threshold the higher rate applies (0.7414ms)
✖ a five year member gets the loyalty uplift on top (0.1802ms)
✖ loyalty is capped at five years (0.166ms)
ℹ tests 4
ℹ suites 0
ℹ pass 1
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 117.0909

✖ failing tests:

test at test\discount.test.js:9:1
✖ at the threshold the higher rate applies (0.7414ms)
  AssertionError [ERR_ASSERTION]: 500 == 1000
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/test/discount.test.js:10:10)

test at test\discount.test.js:13:1
✖ a five year member gets the loyalty uplift on top (0.1802ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/test/discount.test.js:15:10)

test at test\discount.test.js:18:1
✖ loyalty is capped at five years (0.166ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
      at TestContext.<anonymous> (file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/test/discount.test.js:19:10)
```

### 2. `npm run lint`
- **Command**: `npm run lint` (`eslint --config .eslintrc.json src`)
- **Status**: Failed (Exit code 1)
- **Output**:
```
> lint
> eslint --config .eslintrc.json src

'eslint' is not recognized as an internal or external command,
operable program or batch file.
```

### 3. `npm run build`
- **Command**: `npm run build` (`node scripts/build.js`)
- **Status**: Failed (Exit code 1)
- **Output**:
```
> build
> node scripts/build.js

node:internal/modules/cjs/loader:1459
  throw err;
  ^

Error: Cannot find module 'C:\tmp\agent-skills-eval-RYcmZ6\workspace\scripts\build.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    ...
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}
```

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|----------------|
| 1 | **High** | Correctness | Strictly greater-than comparison operator (`>`) excludes orders at the boundary threshold (10,000 minor units) from receiving the 10% discount rate specified in `README.md` and test suite. | [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L5) (`subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05`) causing 3 failing assertions in `npm test`. | Change boundary check to `subtotalMinor >= THRESHOLD_MINOR`. |
| 2 | **Medium** | Correctness / Reliability | Lack of lower-bound clamping for `years` calculation allows future `memberSince` years to generate negative loyalty values, reducing customer discounts below the base rate. | [`src/discount.js:6-7`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L6-L7) (`const years = ...; Math.min(years, 5)`). | Clamp calculated loyalty years using `Math.max(0, Math.min(years, 5))`. |
| 3 | **Medium** | Maintainability | Hardcoded reference date (`'2026-09-01'`) anchors loyalty calculations to September 2026 indefinitely rather than using current date or transaction context. | [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L6) (`new Date('2026-09-01').getFullYear()`). | Replace hardcoded string with dynamic evaluation date or optional `now` parameter. |
| 4 | **Medium** | Tooling | `package.json` defines a `"build"` script pointing to `scripts/build.js`, but the file and directory do not exist. | [`package.json:8`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/package.json#L8) and `npm run build` output (`MODULE_NOT_FOUND`). | Create `scripts/build.js` or correct the script entry in `package.json`. |
| 5 | **Medium** | Tooling | `package.json` defines a `"lint"` script using ESLint with `.eslintrc.json`, but `eslint` is not in `devDependencies` and `.eslintrc.json` is missing. | [`package.json:7`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/package.json#L7) and `npm run lint` output (`'eslint' is not recognized`). | Install `eslint` in `devDependencies` and configure `.eslintrc.json`. |
| 6 | **Low** | Documentation | `README.md` claims all checks pass on every commit, contradicting empirical command failures across test, lint, and build scripts. | [`README.md:6-7`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/README.md#L6-L7) and `Tooling Results` section. | Update `README.md` to accurately reflect the build and test status. |
| 7 | **Info** | Architecture | Clean zero-dependency implementation utilizing native Node.js ES module syntax and `node:test` runner. | [`src/discount.js:4`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L4) and [`test/discount.test.js:1`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/test/discount.test.js#L1). | Maintain lightweight zero-dependency architecture. |

---

## Unconfirmed Issues

### 1. Runtime Type Validation for Arguments
- **Suspected Issue**: Passing non-integer, negative, or non-numeric arguments (such as string numbers, `null`, or `Date` objects) into `discountMinor(subtotalMinor, memberSince)` may produce `NaN` without throwing descriptive errors.
- **Reason Unconfirmed**: The codebase does not specify explicit JSDoc annotations or TypeScript definitions. Without consumer context or explicit runtime validation requirements, it is unconfirmed whether argument type defensive guards are expected.

---

## Summary

### Strengths
1. **Zero External Dependencies**: Implements business logic and testing using Node.js standard runtime capabilities (`node:test` and native ES modules).
2. **Modular Structure**: Clear separation between main logic (`src/discount.js`) and test suite (`test/discount.test.js`).

### Key Risks
1. **Broken Business Logic at Threshold**: The off-by-one comparison (`>`) in [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L5) causes 75% of unit tests to fail (Findings #1, #2).
2. **Broken Developer & CI Tooling**: Both `npm run lint` and `npm run build` fail due to missing dependencies and missing script files (Findings #4, #5).

### Priority Order
1. **Fix Threshold Comparison**: Update `subtotalMinor > THRESHOLD_MINOR` to `>=` in [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L5) to align logic with business specifications and pass unit tests.
2. **Add Loyalty Year Lower-Bound Clamping**: Wrap `Math.min(years, 5)` with `Math.max(0, ...)` in [`src/discount.js:7`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L7).
3. **Fix Build Script Entry**: Add `scripts/build.js` or remove invalid build script in [`package.json:8`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/package.json#L8).
4. **Configure Linting Tooling**: Add `eslint` to `devDependencies` in [`package.json`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/package.json) and add `.eslintrc.json`.
5. **Refactor Hardcoded Date**: Replace hardcoded `'2026-09-01'` string in [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/src/discount.js#L6) with dynamic evaluation date.
6. **Correct Documentation**: Update [`README.md`](file:///C:/tmp/agent-skills-eval-RYcmZ6/workspace/README.md) to reflect actual project state once tooling and tests are fixed.

### Coverage Gaps
- **Performance & Load Testing**: No benchmark tests were executed (out of scope for unit library).
- **Static Type Analysis**: No TypeScript compiler (`tsc`) or type checker was run as the codebase lacks TypeScript setup.
- **Production Context**: Consumer applications, API contracts, and deployment pipelines were not available for inspection.
