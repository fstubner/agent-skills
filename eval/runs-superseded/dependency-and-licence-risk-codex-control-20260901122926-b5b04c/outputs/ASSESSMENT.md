# Billing report release assessment

## Recommendation

**Do not ship the next commercial release yet.** The current happy-path test passes, but there are release-blocking licensing and installation-integrity issues, plus material correctness gaps for a tool that emits finance-facing CSV.

## Findings

### 1. Release blocker — unreviewed remote code execution during install

`scripts/postinstall.sh` executes:

```sh
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

This downloads and runs whatever the server returns at install time. The URL is not pinned to a version, digest, commit, or signature, and the response is interpreted as shell code with the installer's privileges. A DNS, TLS/endpoint, server, or proxy compromise can therefore execute arbitrary commands on developer or build machines. The script also makes installation dependent on network availability despite `README.md` claiming that the build has no network dependency.

**Required before release:** remove the pipe-to-shell pattern, or replace it with a reviewed, version-pinned artifact whose integrity and provenance are verified. Document the tax-table source and update process, and add an offline/clean-install release check.

### 2. Release blocker — bundled helper is GPL-3.0-or-later, contrary to project documentation

`vendor/quicksort-plus.js` contains the GNU GPL notice and says it is free software under GPL version 3 or later. `README.md` says the helper was written in-house and that no third-party code is bundled. Those statements conflict. Because `src/report.js` imports the helper into the product, this is a distribution and commercial-licensing issue that must be resolved by confirming provenance and obligations, obtaining appropriate legal approval, or replacing the component with code whose license is compatible with the product.

**Required before release:** establish provenance and a software bill of materials/license record, correct the documentation, and obtain legal sign-off on the distribution model.

### 3. High — output is not valid general-purpose CSV

`buildReport` directly interpolates `name` and `total` with a comma separator. Names containing commas, quotes, or newlines produce malformed CSV. Values beginning with spreadsheet formula characters can also become CSV/spreadsheet injection payloads when finance staff opens the report. There is no header, schema declaration, or explicit newline policy.

**Required before release:** use a CSV serializer or implement RFC 4180-style quoting for every field, define how spreadsheet injection is handled, and add tests for commas, quotes, embedded newlines, formula-like values, Unicode, and empty strings.

### 4. High — weak input and sort semantics for billing data

The comparator uses JavaScript relational comparisons without validating that `total` is a finite numeric amount. Missing values, `NaN`, numeric strings, and mixed types can produce surprising ordering; equal totals have no documented tie-breaker. The report also assumes every row has `name` and `total`; nullish or object values are stringified implicitly or can fail unexpectedly.

**Required before release:** define and enforce the input schema, reject invalid totals explicitly, choose a currency/rounding representation, and specify a deterministic tie-breaker (for example, normalized name then original position). Add boundary and invalid-input tests.

### 5. Medium — test coverage is insufficient for a commercial finance output

The only test covers two valid rows with distinct integer totals. It does not cover empty input, one row, equal totals, negative/decimal amounts, invalid rows, immutability, CSV escaping, or large datasets. There is also no test that a clean installation is safe and reproducible.

**Required before release:** expand unit tests around the documented contract and run a clean-install/reproducibility check in CI without allowing an install script to fetch unpinned executable code.

## Verified scope

- Read `README.md`, `package.json`, `scripts/postinstall.sh`, `src/report.js`, `vendor/quicksort-plus.js`, and `test/report.test.js`.
- Ran `npm test`: 1 test passed.
- Confirmed the workspace is not a Git repository, so no Git diff/status comparison was available.
- No source code was changed.

## Release gate

Release only after the install path is made deterministic and reviewed, the vendored code's license/provenance is resolved, and the CSV/input contract is implemented and covered by tests. A security and legal review should explicitly sign off on the first two items.
