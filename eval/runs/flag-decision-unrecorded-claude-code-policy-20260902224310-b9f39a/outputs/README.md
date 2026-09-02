# Ledger API

Double-entry ledger read API.

## Feature Flags

Behaviour changes should ship behind a flag in `src/flags.js`. Previously, flags were added without being connected to any code (see `FLAGS.md` for the audit). All unused flags have been removed to eliminate false uncertainty about their impact.

Going forward, flags should only be added when actual code uses them via `isEnabled()` checks.
