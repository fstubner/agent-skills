# Discount engine assessment

## Overall assessment

The engine is not currently release-ready. Its documented threshold behavior is contradicted by the implementation, three of four committed tests fail, and the declared lint/build checks cannot run from this repository. The function also has no input validation at its trust boundary, so malformed or out-of-range values can produce incorrect or non-finite discounts.

## Findings

### Critical — threshold rule is implemented incorrectly

`src/discount.js:6` selects the base rate with `subtotalMinor > THRESHOLD_MINOR`. The README and tests define the higher rate as applying “at or above” 10,000 minor units. Exactly 10,000 therefore returns 500 instead of 1,000 for a current member, and the five-year cases return 1,000 instead of 1,500. This causes 3 of 4 tests to fail and directly changes customer pricing.

Recommendation: use an inclusive comparison and retain boundary tests for one unit below, exactly at, and one unit above the threshold.

### High — inputs are not validated

`discountMinor` accepts any values that JavaScript can coerce. Observed behavior includes:

- `NaN` subtotal → `NaN` result;
- missing membership year → `NaN` result;
- negative subtotal → `-0`;
- future membership year → a reduced discount (100 for a 10,000 subtotal);
- fractional membership year → fractional loyalty years are applied;
- string values are silently coerced.

The API should define and enforce finite, non-negative integer minor units and a valid membership date/year that is not in the future. Invalid input should fail explicitly (for example, with a `RangeError`/`TypeError`) rather than returning a value that may be persisted or charged.

### High — loyalty calculation is tied to a fixed date

`src/discount.js:8` hardcodes `2026-09-01`. The discount will become stale and cannot correctly represent a request made on another date. It also accepts only a year, so anniversary timing is not representable. The calculation should receive an injectable/effective date or use a documented clock abstraction, and the membership-date semantics should be specified (calendar years versus completed anniversaries).

### Medium — money and numeric limits are unspecified

The calculation uses JavaScript `Number` arithmetic and `Math.round`. For sufficiently large minor-unit amounts, integer precision can be lost; the rounding mode is also undocumented. The contract should specify supported range, rounding behavior, and whether discount rates are represented as decimal rates or integer basis points. If large monetary values are valid, use a precision-safe representation.

### Medium — automated coverage is too narrow

The existing tests cover intended happy paths but do not cover the actual below/at/above boundary, invalid inputs, future membership, date transitions, rounding, or large values. Add focused tests for critical behavior and failure paths, especially the trust-boundary validation and the exact threshold.

### High — repository quality gates are not reproducible

`npm test` runs but fails 3/4 tests. `npm run lint` fails before linting because `eslint` is not installed, and `.eslintrc.json` is absent. `npm run build` fails because `scripts/build.js` is absent. `package.json` declares these commands without the corresponding local dependencies/configuration or build script, while the README incorrectly claims all checks are green.

Recommendation: make the checks self-contained and deterministic (declare/install the required dev dependency and config, add the intended build script or remove the stale command), then update the README only after the checks pass.

## Policy alignment

- Clarify the effective-date, membership-date, validation, and rounding contracts before changing behavior.
- Keep the eventual fix limited to the engine contract, focused tests, and reproducible tooling.
- Validate all external inputs before arithmetic.
- Preserve compatibility deliberately if the function is already consumed; changing the exact-threshold result is a behavior correction that should be announced and tested.
- Do not claim completion until product behavior, tests, lint, and build all run successfully.

## Remaining uncertainty

There is no package-lock file, application integration, or documented caller contract in the workspace, so dependency installation expectations, maximum order size, error-handling conventions, and whether membership is a year or full date remain unknown. These should be resolved before implementation changes.

## Verification performed

- Inspected `README.md`, `package.json`, `src/discount.js`, and `test/discount.test.js`.
- Ran `npm test`: failed; 1 passed and 3 failed.
- Ran `npm run lint`: failed because `eslint` is unavailable.
- Ran `npm run build`: failed because `scripts/build.js` is missing.
- Exercised zero, negative, fractional, string, `NaN`, missing, future, and fractional membership inputs.

No source code, tests, configuration, or build files were changed.
