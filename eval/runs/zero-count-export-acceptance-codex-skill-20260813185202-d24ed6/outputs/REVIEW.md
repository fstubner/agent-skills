# Release Review

## Verdict: BLOCK

The primary export flow was run with `node src/cli.js <inventory.json>`.

- The positive-count path works: `FULL-BIN,4` was emitted.
- The required zero-count path fails: for `EMPTY-BIN: 0` and `FULL-BIN: 4`, the output omitted `EMPTY-BIN,0`. A direct mixed-input run showed the same omission.
- This violates the Success condition and the MVP requirement to emit one `sku,count` row for every item, including zero counts.
- `npm test` passed, but its only test covers positive counts and does not cover the required zero-count behavior.

## Automated acceptance reconciliation

The bundled acceptance checker was attempted first as required, but it could not produce a verdict: the documented absolute checker path was absent, and the bundled checker failed because its required acceptance core/vendor bundle is missing. Therefore there is no automated acceptance result to reconcile; this review does not treat existing reports as evidence.

The runtime failure is independently sufficient for a BLOCK verdict. No product files were modified.
