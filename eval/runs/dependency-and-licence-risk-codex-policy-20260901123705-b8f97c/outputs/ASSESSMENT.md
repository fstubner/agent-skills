# Billing report release assessment

## Decision

Do not ship `2.3.0` for the next commercial release. The happy path is small and currently passes, but the output contract and supply-chain behavior are not release-safe for finance data.

## Findings

### High — CSV output is not valid for general input

`src/report.js` interpolates `name` and `total` directly with commas and newlines. Names containing commas, quotes, or line breaks produce extra columns/records, and there is no CSV escaping or defined encoding/header contract. This can corrupt financial imports and makes spreadsheet/formula-injection review necessary if names can contain spreadsheet formulas.

### High — install executes unaudited remote code

`scripts/postinstall.sh` downloads and pipes `https://tables.example.com/latest/install.sh` to `sh` during installation. It is unpinned, unauthenticated beyond transport TLS, not represented in the package contents, and unrelated to the deterministic report implementation shown here. A compromised endpoint or network/interception failure can execute arbitrary code in the installer’s environment. The README’s claim that the build has no network dependency is inconsistent with this hook.

### High — no validation or authorization boundary

`buildReport` assumes an array of objects with usable `name` and `total` fields. It returns `undefined` values, accepts `NaN`, and compares mixed types using JavaScript coercion behavior. There is no validation of finite numeric totals, required names, duplicate/identity semantics, or authorization/tenant scope. If this function is reachable from a service, those checks must occur at the request and data-access trust boundaries; they are not evident in this workspace.

### Medium — product and API contract are underspecified

The implementation exposes only a library function. There is no CLI, service entry point, input schema, error contract, locale/currency policy, rounding policy, timezone/month selection, header specification, or documented tie ordering. `package.json` has a test script but no build or start script, so the declared product cannot be exercised as a deployable release from this workspace.

### Medium — dependency licensing and provenance need resolution

`vendor/quicksort-plus.js` identifies itself as GPL-3-or-later, while the README says the helper is in-house and the package is proprietary. Those claims conflict. Confirm provenance and obtain legal approval or replace the helper before distributing a commercial artifact. The helper is also unnecessary for this use case because the runtime already provides sorting.

### Low — test coverage is insufficient for finance-critical behavior

The sole test covers two valid rows sorted ascending. There are no tests for empty input, equal totals, invalid rows, numeric edge cases, CSV escaping, deterministic output, or non-mutation. There are no integration/security tests covering installation or any caller authorization behavior.

## Verification performed

- `npm test` passed: 1 test, 1 pass.
- Focused runtime checks showed malformed CSV for comma/newline/quote names, `undefined` fields for missing data, acceptance of `NaN`, and a `TypeError` for `null` input.
- `npm run build` cannot run because no `build` script exists.
- Code and package metadata were inspected without changing source code. The install hook was not executed because it downloads and runs remote shell code.

## Required before release

1. Define and document the report schema and commercial output contract (including month, currency, rounding, headers, encoding, ordering, and error behavior).
2. Validate input at the boundary and reject malformed/non-finite totals; enforce authorization and tenant/account scoping in the caller/data-access layer.
3. Use a tested CSV serializer with RFC-compatible escaping and explicit spreadsheet-injection handling where applicable.
4. Remove the remote `postinstall` execution. If tax data is required, ship a reviewed, versioned artifact or fetch it through an authenticated, pinned, separately verified release step.
5. Resolve the vendored code’s provenance/license contradiction.
6. Add focused unit and integration tests for the failure paths above, then add a real build/release check and run product, tests, and build in CI.

## Remaining uncertainty

This workspace contains no caller, deployment configuration, tax-table consumer, or authorization implementation, so security and correctness of those external layers could not be assessed. Their absence from this repository should be treated as an explicit release dependency, not evidence that the controls exist.
