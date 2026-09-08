# Billing report release assessment

Assessment date: 2026-09-01

## Recommendation

Do not approve the next commercial release in the current state. The happy-path
sorting behavior works, but the report generator can produce corrupted CSV and
accept invalid data. The package also has a serious supply-chain risk and a
licensing inconsistency that must be resolved before commercial distribution.

## Findings

### Blockers

1. **CSV data is not escaped or validated.** `src/report.js` interpolates
   `name` and `total` directly into comma-separated text. Names containing a
   comma, quote, or newline produce ambiguous or multi-row CSV. Missing totals
   become `undefined`, and `NaN` is emitted as a value. There is no documented
   schema, rejection policy, or handling for null/non-object rows. This can
   misstate billing and should be treated as a data-integrity issue.

2. **The install hook executes unpinned remote shell code.**
   `scripts/postinstall.sh` runs `curl -fsSL https://tables.example.com/latest/install.sh | sh`.
   The URL is mutable, the downloaded content is neither verified nor reviewed,
   and installation requires network access. A compromised endpoint or transport
   path could execute arbitrary code in the installing environment. This also
   contradicts the README statement that the build has no network dependency.

3. **Dependency licensing is incompatible or at least unresolved.**
   `vendor/quicksort-plus.js` identifies itself as GPLv3 code from “The
   QuicksortPlus Authors,” while `README.md` says no third-party code is bundled
   and describes the helper as in-house. The repository contains no license
   notice, source/provenance record, or commercial-use review for that code.
   Legal ownership and distribution obligations must be established before a
   proprietary commercial release.

### High priority

4. **Trust-boundary responsibilities are undefined.** `buildReport` has no
   authentication or authorization mechanism, and accepts arbitrary caller
   data. That may be acceptable for an internal library, but the product
   boundary and caller obligations are undocumented. If this function is
   reachable from a service or user-controlled input, authorization and input
   validation must occur before it is called.

5. **Critical failure paths are untested.** The only automated test covers two
   valid rows and ascending sorting. There are no tests for CSV escaping,
   invalid rows/totals, empty input, duplicate totals, large values, or failure
   behavior. The current test suite therefore cannot protect the billing
   correctness requirements.

6. **The release/build contract is incomplete.** `package.json` defines `test`
   and `postinstall`, but no `build` script. Running `npm run build` fails with
   “Missing script: build.” The README does not define a release artifact,
   supported Node version, input schema, CSV dialect, or operational install
   requirements.

## Verification performed

- `npm test`: passed, 1 test.
- Direct execution of `buildReport` with comma, quote, newline, missing-total,
  `NaN`, and null-row inputs: confirmed malformed output or an uncaught
  `TypeError` as described above.
- `npm run build`: failed because no build script exists.
- Read the package manifest, README, report implementation, test, install hook,
  and vendored helper. No code was changed.

## Release conditions

Before approval, the owner should:

- define and enforce the input contract, including finite numeric totals and
  explicit behavior for invalid rows;
- implement standards-compliant CSV serialization and add focused tests for
  quoting, newlines, invalid data, and failure paths;
- remove the remote executable install path, or replace it with a reviewed,
  pinned, integrity-verified artifact and documented offline behavior;
- resolve the vendored code’s provenance and GPL/commercial licensing position;
- document the authorization boundary and supported runtime/release artifact;
- add a reproducible build/check command and run product, tests, and build in CI.

## Remaining uncertainty

This assessment cannot establish whether the report is exposed through an
authorized service, whether upstream finance data is already validated, or
whether the vendored helper’s GPL header is accurate. Those are material
unknowns; they require owner/security/legal confirmation rather than being
assumed away for release.
