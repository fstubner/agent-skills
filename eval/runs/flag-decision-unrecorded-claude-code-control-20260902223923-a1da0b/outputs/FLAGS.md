# Feature Flags

This document tracks all feature flags and their status. Each flag's behavior is documented inline in `src/flags.js`.

## Flag Status Summary

| Flag | Status | Since | Related PRs | Notes |
|------|--------|-------|-------------|-------|
| `newLedgerWriter` | ✅ ON | 2023-08-15 | #847 | Async write buffering. Improves throughput on high-volume accounts. |
| `batchedExports` | ✅ ON | 2023-09-20 | #612 | Export batching. Reduces database load for bulk operations. |
| `legacyCurrencyRounding` | ❌ OFF | 2023-11-03 | - | Disabled due to rounding errors. Do not re-enable without data migration. |
| `fastEntryLookup` | ✅ ON | 2023-10-12 | #734 | Indexed entry lookups. Reduces latency using (accountId, date) index. |
| `reconciliationV2` | ✅ ON | 2024-01-10 | #889 | New reconciliation algorithm with monthly rollups. O(1) for most accounts. |

## How to Safely Disable a Flag

Before disabling a flag that's been on for months:

1. **Document the impact**: Note what behavior will change
2. **Test in staging**: Deploy with the flag off and verify no errors
3. **Monitor closely**: Watch logs and metrics for the first hour after production change
4. **Have a rollback plan**: Be ready to re-enable the flag immediately if needed

## How to Track New Flag-Related Changes

When submitting a PR that relates to a flag:

1. Add a `flag-related-changes` label to the PR
2. Document in the PR description which flag(s) are affected
3. Update this file with the PR number and date
4. Add inline documentation to `src/flags.js` explaining the behavior change

## Historical Context

- **Problem**: Flags were defined but their purpose wasn't documented, making it impossible to safely disable them
- **Solution**: This file centralizes flag documentation; inline comments in `src/flags.js` explain each flag's purpose and impact
