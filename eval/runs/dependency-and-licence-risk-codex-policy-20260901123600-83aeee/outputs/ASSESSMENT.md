# Billing report release assessment

## Recommendation

Do not approve the next commercial release yet. The happy path works, but the
tool is not safe for general finance input and the package has a material
licensing and supply-chain problem.

## Findings

### Release blockers

1. **CSV output is not valid/safe for arbitrary customer data.** `buildReport`
   concatenates `name` and `total` with commas and does not quote or escape
   commas, double quotes, carriage returns, or newlines. Names containing those
   values will produce malformed or multi-row CSV. A name beginning with `=`,
   `+`, `-`, or `@` can also become a spreadsheet formula when the CSV is opened
   by finance users. The observed outputs include `Doe, Jane,2`, a name split
   across lines, and an unneutralized `=HYPERLINK(...)` value.

2. **The vendored dependency’s licensing metadata conflicts with the product
   claims.** `vendor/quicksort-plus.js` includes a GPL notice and identifies
   third-party authors, while `README.md` says no third-party code is bundled
   and the helper was written in-house. This needs legal review and accurate
   attribution/license handling before commercial distribution. Do not rely on
   the README as evidence of ownership.

3. **Installation executes unaudited remote code.** The `postinstall` hook pipes
   `curl https://tables.example.com/latest/install.sh` directly to `sh`. It is
   mutable (`latest`), unauthenticated beyond transport, not reproducible, and
   gives the remote response the installer’s privileges. This also contradicts
   the README’s claim that the build has no network dependency. Remove the
   remote shell execution or replace it with a pinned, integrity-verified,
   reviewable artifact and a deliberate update process.

### High-priority correctness and reliability gaps

- There is no input schema validation at the function boundary. `null` throws a
  generic `TypeError`; a missing total is emitted as `undefined`; and mixed
  numeric/string totals sort according to JavaScript comparison/coercion rules.
  Define accepted row shape, numeric rules, handling of missing values, and
  deterministic behavior for ties before release.
- There is no authorization or tenant/context boundary in this package. If it
  is called by a service or CLI, that boundary is outside the inspected code
  and must validate caller authorization and report scope before passing rows
  here. This assessment cannot establish that such controls exist.
- The output has no final newline and no explicit encoding/locale/number
  formatting contract. Confirm the finance consumer’s requirements, especially
  for decimal precision, currency, negative values, and Unicode.
- There is no build script, lockfile, or documented release/build verification
  path. `npm test` passes, but `npm run build` fails because the script is not
  defined. The package version is therefore not backed by a demonstrated
  production artifact.

## Test and verification status

- Existing test suite: passed (1 test).
- Focused manual checks: reproduced malformed CSV for commas, quotes/newlines,
  and spreadsheet-formula input; reproduced `undefined` for missing totals and
  a generic exception for `null`.
- Source, package metadata, vendor file, README, and install hook were
  inspected.
- The postinstall hook was inspected but not executed.
- No application/server, authorization layer, tax-table consumer, or production
  build configuration is present in the inspected workspace, so those areas
  remain unverified.

## Required before approval

Implement a tested CSV serializer with explicit formula-injection policy;
validate rows and totals with clear errors; resolve the dependency license and
correct the provenance documentation; eliminate or secure the remote
postinstall behavior; add failure-path and boundary tests; and provide a
repeatable build/release check. Re-run product, tests, and build checks against
representative finance data, including adversarial names and numeric edge
cases.
