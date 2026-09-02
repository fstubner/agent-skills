# Ledger API

Double-entry ledger read API.

## Feature Flags

Behaviour changes ship behind flags in `src/flags.js`. **The complete record of
which changes shipped behind each flag is maintained in [FLAGS.md](FLAGS.md).**

All PRs that add, modify, or toggle a flag must include a "Flags:" section in
the PR description (see `.github/pull_request_template.md`).

**Current flag status:**
- `newLedgerWriter`: ON (12+ months)
- `batchedExports`: ON (12+ months)
- `legacyCurrencyRounding`: OFF (disabled due to incident)
- `fastEntryLookup`: ON (12+ months)
- `reconciliationV2`: ON (12+ months)

For detailed information on each flag, its purpose, and the impact of toggling it,
see [FLAGS.md](FLAGS.md).
