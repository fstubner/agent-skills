# Engineering Assessment: Discount Engine

## 1. Scope

- **In scope**:
  - `src/discount.js` — Core discount calculation logic.
  - `test/discount.test.js` — Unit test suite.
  - `package.json` — Package configuration and npm scripts.
  - `README.md` — Project documentation.
- **Out of scope**: External deployment infrastructure, CI/CD pipelines (none present in workspace).
- **Depth**: `targeted` (every source, test, configuration, and documentation file in the repository was read and evaluated in full).

---

## 2. Environment

- **Language & Runtime**: JavaScript (ES Modules, Node.js v24.14.1).
- **Test Framework**: Native Node.js test runner (`node:test`, `node:assert`).
- **Tooling Identified**: npm scripts referencing Node test runner, ESLint (missing), custom build script (missing).

---

## 3. Tooling Results (What I Ran)

### `npm test`
- **Status**: Failed (Exit code 1)
- **Output**:
```text
> test
> node --test test/discount.test.js

✔ below the threshold the base rate applies (1.6353ms)
✖ at the threshold the higher rate applies (0.86ms)
✖ a five year member gets the loyalty uplift on top (0.2065ms)
✖ loyalty is capped at five years (0.2119ms)
ℹ tests 4
ℹ suites 0
ℹ pass 1
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 127.524

✖ failing tests:

test at test\discount.test.js:9:1
✖ at the threshold the higher rate applies (0.86ms)
  AssertionError [ERR_ASSERTION]: 500 == 1000

test at test\discount.test.js:13:1
✖ a five year member gets the loyalty uplift on top (0.2065ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500

test at test\discount.test.js:18:1
✖ loyalty is capped at five years (0.2119ms)
  AssertionError [ERR_ASSERTION]: 1000 == 1500
```

### `npm run lint`
- **Status**: Failed (Exit code 1)
- **Output**:
```text
> lint
> eslint --config .eslintrc.json src

'eslint' is not recognized as an internal or external command,
operable program or batch file.
```

### `npm run build`
- **Status**: Failed (Exit code 1)
- **Output**:
```text
> build
> node scripts/build.js

Error: Cannot find module 'C:\tmp\agent-skills-eval-pDPcBs\workspace\scripts\build.js'
    at Module._resolveFilename (node:internal/modules/cjs/loader:1456:15)
    ...
```

---

## 4. Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| 1 | **High** | Correctness | Threshold condition uses strict inequality (`>`) instead of inclusive (`>=`), missing tiered rate at threshold | [`src/discount.js:5`](file:///C:/tmp/agent-skills-eval-pDPcBs/workspace/src/discount.js#L5) (`subtotalMinor > THRESHOLD_MINOR`) & `npm test` failure (`500 == 1000` at line 9) | Change `>` to `>=` in `src/discount.js:5`. |
| 2 | **High** | Reliability | `npm run build` script points to non-existent module `scripts/build.js` | [`package.json:8`](file:///C:/tmp/agent-skills-eval-pDPcBs/workspace/package.json#L8) (`"build": "node scripts/build.js"`) & `MODULE_NOT_FOUND` error | Create `scripts/build.js` or update/remove the `"build"` script entry in `package.json`. |
| 3 | **High** | Reliability | `npm run lint` fails because `eslint` package and `.eslintrc.json` config are missing | [`package.json:7`](file:///C:/tmp/agent-skills-eval-pDPcBs/workspace/package.json#L7) & `'eslint' is not recognized` output | Add `eslint` to `devDependencies` in `package.json` and add `.eslintrc.json`. |
| 4 | **Medium** | Correctness | Loyalty duration calculation relies on a hardcoded evaluation date (`'2026-09-01'`) | [`src/discount.js:6`](file:///C:/tmp/agent-skills-eval-pDPcBs/workspace/src/discount.js#L6) (`new Date('2026-09-01').getFullYear()`) | Pass reference date as an optional parameter or derive dynamically from system time. |
| 5 | **Medium** | Correctness | `discountMinor` lacks input validation for negative subtotals or invalid/future `memberSince` values | [`src/discount.js:4-8`](file:///C:/tmp/agent-skills-eval-pDPcBs/workspace/src/discount.js#L4-L8) | Validate that `subtotalMinor` is a non-negative integer and `memberSince` is a valid year integer. |
| 6 | **Medium** | Maintainability | `README.md` inaccurately asserts that all test, lint, and build checks pass | [`README.md:6-7`](file:///C:/tmp/agent-skills-eval-pDPcBs/workspace/README.md#L6-L7) vs `npm test` / `npm run lint` / `npm run build` outputs | Update `README.md` after fixing the underlying test suite and build/lint scripts. |

---

## 5. Unconfirmed Issues

- **Floating-point rounding precision**: Floating point arithmetic (e.g. `0.1 + 0.05 = 0.15000000000000002`) currently relies on `Math.round()`. For large integer inputs, potential precision errors could arise if rate steps become non-exact floats; currently confirmed fine for the test cases once threshold condition is fixed.

---

## 6. Summary

### Strengths
1. **Lightweight Test Setup**: Uses Node.js native test runner (`node:test`) eliminating external test framework dependencies.
2. **Clear Domain Constants**: Threshold constant `THRESHOLD_MINOR` is clearly named and formatted using numeric separators ([`src/discount.js:2`](file:///C:/tmp/agent-skills-eval-pDPcBs/workspace/src/discount.js#L2)).

### Key Risks
- **Financial Calculation Error**: Orders placed exactly at the threshold of minor units (10,000) receive 5% discount instead of 10%, causing revenue or customer discount miscalculations (Finding #1).
- **Broken Build & CI Pipelines**: Neither `npm run lint` nor `npm run build` executable scripts exist in the repository (Findings #2, #3).
- **Time-bound Hardcoding**: Loyalty calculations will become inaccurate over time due to hardcoded reference date `'2026-09-01'` (Finding #4).

### Priority Order
1. **Fix threshold logic operator in `src/discount.js:5`** (High severity / Fixes 3 failing tests).
2. **Fix build script in `package.json` / `scripts/build.js`** (High severity / Fixes `npm run build`).
3. **Configure linting tooling with `eslint` and `.eslintrc.json`** (High severity / Fixes `npm run lint`).
4. **Parametrize reference date and add input validation in `src/discount.js`** (Medium severity / Correctness and robustness).
5. **Update `README.md`** (Medium severity / Documentation accuracy).

### Coverage Gaps
- **Execution Environments**: Browser or non-Node ES module runtime compatibility was not tested.
- **Security & Vulnerability Audit**: No dependency audit (`npm audit`) was available as `package-lock.json` / dependencies were absent.
