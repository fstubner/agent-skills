# Discount engine assessment

## Executive summary

The engine is small and easy to follow, but it is not currently release-ready. The documented threshold behavior is not implemented, the test suite is failing, and the public function has no trust-boundary validation. Time handling is also hard-coded, which makes loyalty calculations stale and difficult to test reliably.

## Findings

### High — threshold behavior contradicts the specification and tests

`src/discount.js` selects the higher rate only when `subtotalMinor > 10_000`. The README and test name require the higher rate at `10_000` and above. Consequently, `discountMinor(10000, 2026)` returns `500` instead of the tested/documented `1000`; the three threshold-dependent tests fail.

### High — invalid inputs can produce incorrect financial results

The function accepts values without checking type, finiteness, sign, or allowed range. For example, a negative subtotal returns a negative discount (`discountMinor(-100, 2026) === -5`), and a future membership year reduces the discount (`discountMinor(10000, 2027) === 400`). `null` is coerced by arithmetic and produces a plausible-looking result, masking bad input. Since this is a money calculation, inputs should be validated at the API boundary and failure behavior should be explicit.

### Medium — loyalty calculation depends on a hard-coded date

`new Date('2026-09-01')` is embedded in the implementation. The result will stop reflecting reality after that date, and callers cannot evaluate the calculation as of a supplied date. The calculation also uses only a year, so it cannot account for whether the membership anniversary has occurred.

### Medium — rounding and domain contracts are undocumented

The implementation rounds the final discount to the nearest minor unit, but the policy for negative/decimal subtotals, fractional membership years, and rates that could exceed a sensible maximum is unspecified. These should be explicit, especially if this function is called by payment or order systems.

### Low — repository quality gates are not reproducible from the workspace

`package.json` advertises lint and build scripts, but `.eslintrc.json`, the ESLint executable/dependency, and `scripts/build.js` are not present in the workspace. The README claim that all checks are green is therefore inaccurate here. The test command is present and runs, but currently fails.

## Test coverage assessment

Existing tests cover the intended below-threshold case and loyalty capping, but they do not cover invalid input, future membership, date-boundary behavior, rounding, or the exact threshold with loyalty under a correct implementation. The critical boundary test is present and correctly exposes the current defect.

## Recommended disposition

Do not release until the threshold rule is aligned with the specification, input and date semantics are defined and enforced, and the failing tests are corrected or the implementation is brought into agreement with them. Add focused failure-path and date-boundary tests, then restore reproducible lint/build tooling. Keep the implementation change additive and backwards-compatible for any persisted order data; no data migration appears necessary from the files inspected.

## Verification performed

- Inspected `README.md`, `src/discount.js`, `test/discount.test.js`, and `package.json`.
- Ran `npm test`: failed, 3 of 4 tests failing (`500` vs `1000`, and `1000` vs `1500` in two loyalty cases).
- Attempted `npm run lint`: could not run because `eslint` is not installed/available and `.eslintrc.json` is absent.
- Attempted `npm run build`: could not run because `scripts/build.js` is absent.
- Performed read-only edge probes for negative, future, null, string, and fractional membership inputs.

No source or test code was changed.
