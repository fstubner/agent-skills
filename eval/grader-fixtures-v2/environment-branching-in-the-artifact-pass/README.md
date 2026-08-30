# Ledger API

Invoice fee API. One image is built per commit and promoted by digest from
staging to production.

Nothing in the codebase asks which environment it is running in. The three
places that used to — fee rounding, the second-factor check, and receipt
delivery — read values from `src/config.js` instead, so staging runs the same
code path production runs and only the values differ.

Every setting defaults to the strict behaviour. A variable dropped from a
deploy leaves the service requiring a second factor and delivering receipts,
rather than quietly doing neither.

Staging's fee arithmetic used to round differently so that seeded invoices
matched a test spreadsheet, which meant the arithmetic production runs was
never exercised before a release. The spreadsheet was the thing that was
wrong.
