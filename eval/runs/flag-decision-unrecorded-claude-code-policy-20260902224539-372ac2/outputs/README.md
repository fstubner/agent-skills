# Ledger API

Double-entry ledger read API.

## Feature flag audit (resolved)

All feature flags have been audited. The code behind each flag has been
permanently integrated into the application, and flag checks have been removed
from the codebase. See `src/flags.js` for a complete history of each flag and
what it controlled.
