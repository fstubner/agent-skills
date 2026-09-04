# Engineering Assessment: Discount Engine

## Scope

**In scope:**
- `src/discount.js` — main discount calculation logic (9 lines)
- `test/discount.test.js` — test suite (21 lines)
- `package.json` — project configuration and declared build/test/lint scripts
- `README.md` — project documentation

**Out of scope:**
- Assessment framework files (`.agent-input/`)
- Evaluation cases, graders, expected answers, or sibling run outputs (as instructed)

**Depth:** Targeted — all in-scope files read in full.

---

## Environment

**Language & Runtime:** JavaScript (Node.js v24.14.1, ES6 modules)

**Domain:** Business logic — discount calculation engine

**Framework/Dependencies:** None declared or installed

**Build System:** npm (package.json defines `test`, `lint`, and `build` scripts)

---

## Tooling Results

### What I ran:

| Tool | Command | Result |
|------|---------|--------|
| Node.js | `node --version` | v24.14.1 (available) |
| npm | `which npm` | `/c/Users/Felix/.nvx/bin/npm` (available) |
| Dependencies check | `ls node_modules` | Not installed |

### Tools not run:

| Tool | Reason |
|------|--------|
| `npm test` | Requires npm dependencies to be installed; not installed in workspace. Would run `node --test test/discount.test.js`. |
| `npm run lint` | `.eslintrc.json` file does not exist; ESLint not configured or installed. Script references non-existent config. |
| `npm run build` | `scripts/build.js` does not exist; build script misconfigured. |
| Dependency audit | `npm audit` skipped (dependencies not installed). |

---

## Findings Table

| # | Severity | Area | Finding | Evidence | Recommendation |
|---|----------|------|---------|----------|-----------------|
| 1 | Critical | Correctness | Threshold boundary condition uses wrong operator | `src/discount.js:5` — code uses `subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;` but test "at the threshold the higher rate applies" (line 10 of test file) asserts `discountMinor(10000, 2026)` should equal `1000`. At exactly 10000, the condition `10000 > 10000` evaluates to `false`, applying rate 0.05 instead of 0.1, yielding ~500 instead of expected 1000. README states "10% at or above it", requiring `>=` operator. | Change line 5 from `subtotalMinor > THRESHOLD_MINOR` to `subtotalMinor >= THRESHOLD_MINOR`. |
| 2 | Critical | Correctness | Hardcoded reference date breaks loyalty calculation after its fixed point | `src/discount.js:6` — code uses hardcoded `new Date('2026-09-01').getFullYear()` instead of `new Date().getFullYear()`. This date is fixed and will not update. After September 1, 2026, loyalty years will stop increasing for any member, causing discount calculations to decay for all new orders. Membership loyalty is meant to grow over time; a hardcoded date makes the function stale and incorrect by the next day. | Replace `new Date('2026-09-01').getFullYear()` with `new Date().getFullYear()` to use the actual current date. |
| 3 | High | Reliability | Build and lint scripts reference non-existent files | `package.json:8-9` — `npm run lint` references `.eslintrc.json` which does not exist; `npm run build` references `scripts/build.js` which does not exist. These scripts cannot run and will fail immediately. README claims "all checks pass" but they cannot be verified. | Create `.eslintrc.json` with ESLint configuration and `scripts/build.js` with build logic, or remove scripts from package.json if not needed. |
| 4 | Medium | Maintainability | Project has no dependencies installed | Workspace root contains no `node_modules/` directory and no lock file (`package-lock.json` or `yarn.lock`) committed. Tests cannot run; reproducibility is compromised. | Run `npm install` or `npm ci` to populate dependencies and commit lock file. |
| 5 | Medium | Maintainability | Hardcoded configuration value not externalized | `src/discount.js:2` — `THRESHOLD_MINOR` is hardcoded to `10_000` (in minor currency units). Changing this threshold requires code modification. For a discount engine, this is a business policy value that may need to be adjusted without code release. | Extract threshold to an environment variable or configuration file (e.g., `process.env.DISCOUNT_THRESHOLD_MINOR`) and document expected format. |

---

## Unconfirmed Issues

None identified. All findings above are confirmed through code inspection.

---

## Summary

### Strengths

1. **Clear, single-purpose function** — `discountMinor()` has a focused responsibility: calculate a tiered discount with loyalty uplift. The code is short and intent is evident.
2. **Test coverage for main paths** — Four test cases cover the base scenarios: below threshold, at threshold, loyalty bonus, and loyalty cap. Tests are readable and well-commented.
3. **Correct rounding strategy** — Use of `Math.round()` at the end (line 8) ensures discount amounts are whole currency units, avoiding precision drift.

### Key Risks

**Critical correctness defects block deployment:**

- **Finding #1**: The threshold condition bug will cause wrong discount rates for orders at exactly the threshold amount (10000 minor units). The code applies 5% instead of 10%, dramatically undercutting the intended discount and confusing users.
- **Finding #2**: The hardcoded date reference makes the loyalty calculation permanent as of 2026-09-01. Any order placed on or after 2026-09-02 will receive incorrect loyalty bonuses, degrading customer rewards over time.

**High reliability issue:**

- **Finding #3**: Declared npm scripts reference missing files. The README claims "all checks pass", but three out of four scripts (lint, build, and implicit npm install) will fail.

### Priority Order

1. **Fix threshold boundary condition** (Finding #1) — Change `>` to `>=` on line 5. Quick fix, critical correctness impact.
2. **Replace hardcoded date** (Finding #2) — Change line 6 to use `new Date().getFullYear()`. Quick fix, critical correctness impact.
3. **Create missing build configuration files** (Finding #3) — Implement `.eslintrc.json` and `scripts/build.js` or remove from package.json. Medium effort to verify correctness, high impact on claimed test status.
4. **Install and commit dependencies** (Finding #4) — Run `npm install && npm ci`, commit lock file. Enables reproducible builds.
5. **Externalize threshold configuration** (Finding #5) — Extract `THRESHOLD_MINOR` to environment variable. Low effort, improves operational flexibility.

---

## Coverage Gaps

**Code areas not examined:**
- None — all source files (9 total lines of logic) were read in full.

**Automated checks not run:**
- `npm test` — Cannot run without npm dependencies installed.
- `npm run lint` — Cannot run; ESLint config file missing.
- `npm run build` — Cannot run; build script file missing.
- Dependency vulnerability audit — Cannot run without dependencies installed.

**Testing not performed:**
- Runtime execution of tests (blocked by missing dependencies and configuration).
- Edge cases not covered by existing tests (e.g., negative subtotals, `memberSince` in future, extremely old member year).
- Performance testing (not applicable to a single-line calculation).
- Integration testing (no external dependencies or I/O to test).

**Production information unavailable:**
- Deployment target and environment configuration.
- Historical discount data to validate correctness.
- SLA or performance requirements.
- Whether this code is currently deployed and in what state.

