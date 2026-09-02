# Feature Flag History

This document records the feature flags that were used to gate changes in the ledger API.

## Flags Audit (as of 2026-09-02)

### Flag Status Summary

All flags defined in `src/flags.js` are **not actively referenced** in the codebase. They represent features that were either:
- Permanently deployed (flags set to `true` for over 1 year)
- Intentionally disabled (flags set to `false` and left disabled)

Since these flags are not checked anywhere in the code, the application's behavior is unaffected by their values.

### Flags Permanently Deployed (True)

These flags have been on for over 1 year and are candidates for removal:

| Flag | Status | Inferred Purpose | Current Behavior |
|------|--------|------------------|------------------|
| `newLedgerWriter` | **ON** (1+ year) | New ledger entry writing implementation | Baked into current code |
| `batchedExports` | **ON** (1+ year) | Batching export operations for performance | Baked into current code |
| `fastEntryLookup` | **ON** (1+ year) | Optimized entry lookup performance | Baked into current code |
| `reconciliationV2` | **ON** (1+ year) | Second version of reconciliation logic | Baked into current code |

All four of these flags are permanently enabled in the flags configuration, indicating the gated features have been fully deployed.

### Flags Intentionally Disabled (False)

| Flag | Status | Reason | Notes |
|------|--------|--------|-------|
| `legacyCurrencyRounding` | **OFF** | Disabled during incident | Old currency rounding behavior removed. Replaced by new rounding logic. |

## Decision: Remove Dead Flags

Since none of these flags are checked in the codebase:
- Removing them will not change application behavior
- The features they gated are now permanent parts of the system
- Keeping dead flags creates confusion about what actually controls the application

## Removed Flags (Post-Cleanup)

After cleanup, `src/flags.js` retains only:
- Empty flags object (for future use if needed)
- `isEnabled()` function (infrastructure for future flags)
- Documentation of what was removed and why

This maintains the flag system for future needs while eliminating the confusion of dead flags.
