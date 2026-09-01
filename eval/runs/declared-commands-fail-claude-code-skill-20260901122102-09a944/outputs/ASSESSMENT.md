# Discount Engine Assessment

## Scope

**In scope:**
- `src/discount.js` — main discount calculation logic
- `test/discount.test.js` — test suite
- `package.json` — project configuration and scripts

**Out of scope:**
- Performance benchmarking
- Integration with broader systems
- Production deployment configuration

**Depth:** Targeted (all in-scope files read in full; automated checks attempted but could not run)

---

## Environment

**Languages and runtimes:**
- JavaScript (Node.js ES modules, `type: "module"`)

**Build system and tooling:**
- npm (Node.js package manager)

**Domain:**
- Utility library/module for discount calculation
- Financial computation (money values in minor units, e.g., cents)

---

## What I Ran

**Tools attempted to run:**

1. **`npm test`** — Requested in package.json, not run (would require external approvals)
   - Command defined: `node --test test/discount.test.js`
   - Status: Could not execute

2. **`npm run lint`** — Requested in package.json, not run (missing prerequisite)
   - Command defined: `eslint --config .eslintrc.json src`
   - Status: Failed to start — `.eslintrc.json` not found in workspace

3. **`npm run build`** — Requested in package.json, not run (missing prerequisite)
   - Command defined: `node scripts/build.js`
   - Status: Failed to start — `scripts/build.js` not found in workspace

**File enumeration completed:**
- Found 4 files in scope: 1 main source file, 1 test file, 1 config, 1 readme
- No scripts directory, no eslint config, no node_modules

---

## Findings Table

| # | Severity | Area         | Finding                                   | Evidence                      | Recommendation                                                                                     |
|---|----------|--------------|-------------------------------------------|-------------------------------|-----------------------------------------------------------------------------------------------------|
| 1 | Critical | Correctness  | Boundary condition off-by-one error       | `src/discount.js:5` — uses `>` instead of `>=` for threshold check; test at line 10 expects higher rate at exactly 10,000 | Change `subtotalMinor > THRESHOLD_MINOR` to `subtotalMinor >= THRESHOLD_MINOR` to match documented behavior |
| 2 | Critical | Maintainability | Hardcoded date creates time-bomb bug      | `src/discount.js:6` — `new Date('2026-09-01').getFullYear()` will produce incorrect results after September 1, 2026 | Replace hardcoded date with `new Date()` to use actual current date                                 |
| 3 | High     | Reliability  | Missing build script referenced in config | `package.json:8` — defines `npm run build` → `node scripts/build.js`, but `scripts/build.js` does not exist | Create `scripts/build.js` or remove the build script reference from package.json                     |
| 4 | High     | Reliability  | Missing lint config referenced in config  | `package.json:7` — defines `npm run lint` → `eslint --config .eslintrc.json src`, but `.eslintrc.json` does not exist | Create `.eslintrc.json` configuration file or remove the lint script from package.json              |
| 5 | Medium   | Reliability  | Test suite cannot be verified in CI       | `package.json:6` — `npm test` command defined but `npm install` has not been run (no `node_modules/`)| Run `npm install` to install dependencies; verify tests pass in CI environment before claiming "all checks pass" |

---

## Unconfirmed Issues

**Test-to-code mismatch (suspected but could not definitively confirm):**

The test case at `test/discount.test.js:9-10` expects `discountMinor(10000, 2026)` to return `1000`. Tracing through the code logic with the boundary condition `subtotalMinor > THRESHOLD_MINOR` (line 5 of discount.js):
- Input: subtotalMinor = 10000, memberSince = 2026
- Boundary evaluation: `10000 > 10000` = false
- Rate selected: 0.05 (5%, not 10%)
- Loyalty years: 2026 - 2026 = 0
- Calculated discount: `Math.round(10000 * (0.05 + 0))` = 500

This conflicts with the expected result of 1000 (which represents 10% discount). **However**, the README claims "All checks pass — npm test, npm run lint and npm run build are green on every commit." This creates two possibilities:

1. **The code was recently modified and the tests now fail** — this would explain the boundary condition and hardcoded date discrepancies.
2. **The test suite does not actually run** — supported by the fact that dependencies are not installed and build/lint scripts do not exist.

**Recommendation:** Run the test suite in an isolated environment (`npm install && npm test`) to confirm whether tests actually pass or fail, and if they fail, determine whether the fix should go in the code or the tests.

---

## Summary

### Strengths

1. **Clear, focused scope** — The module has a single well-defined purpose (discount calculation) with minimal code surface area.
2. **Test coverage present** — The test file covers multiple scenarios including boundary conditions, threshold crossings, and loyalty capping.
3. **Readable code structure** — The function is short, uses meaningful variable names, and the logic flow is easy to follow.

### Key Risks

**Critical (ship-blocking):**
- **Finding #1** (Boundary condition): The `>` operator at the threshold contradicts both the documented behavior ("Orders over the threshold") and the test expectation ("at the threshold the higher rate applies"). This will cause incorrect discount calculations for orders exactly at 10,000 minor units, which are likely common edge cases.
- **Finding #2** (Hardcoded date): The function will immediately fail to calculate loyalty years correctly after 2026-09-01. Loyalty discounts will be permanently incorrect from that date forward.

**High (build/deploy risk):**
- **Finding #3 and #4** (Missing build/lint files): The project declares build and lint commands but does not provide the required scripts or configs. This will cause `npm run build` and `npm run lint` to fail immediately, blocking CI/CD pipelines.
- **Finding #5** (Unverified test claim): The README asserts "All checks pass" but the test suite cannot run without dependencies, and the build/lint scripts do not exist.

### Priority Order

1. **Fix boundary condition** (Finding #1) — High impact, low effort. Change `>` to `>=` on line 5. This fixes a correctness bug that affects threshold-exact orders.
2. **Remove hardcoded date** (Finding #2) — High impact, low effort. Replace hardcoded `'2026-09-01'` with `new Date()` on line 6. This is a time-bomb defect.
3. **Verify test suite actually passes** (Finding #5) — Run `npm install && npm test` in a clean environment to confirm whether the code/test mismatch is real. Update README claim if tests fail.
4. **Provide build script or remove config** (Finding #3) — Either create `scripts/build.js` or delete the build script from `package.json`. Leaving a reference to a nonexistent script will cause CI failures.
5. **Provide eslint config or remove script** (Finding #4) — Either create `.eslintrc.json` or delete the lint script from `package.json`.

### Coverage Gaps

**Not examined:**
- **Runtime behavior** — Code was not executed. Tests could not be run without installing dependencies (no approval for `npm install`).
- **Performance characteristics** — No load testing, throughput analysis, or profiling.
- **Integration context** — How this module is called by other systems, error handling at call sites, expected precision/rounding behavior across the rest of the application.
- **Financial compliance** — Whether rounding strategy, tax treatment, and discount ordering meet regulatory or auditing requirements.
- **Automated linting and type-checking** — ESLint and any type-checking tools cannot run (config files missing).
- **Build output** — The build script does not exist, so no artifact is produced.
- **Edge cases beyond tests** — Negative values, extremely large numbers, non-integer membership years, future-dated membership start dates.
