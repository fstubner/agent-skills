# Feature Flags Documentation

This document provides the permanent record of all feature flags, their purposes, and which changes shipped behind them.

## Quick Reference

| Flag | Status | Old Behavior | Current Behavior |
|------|--------|--------------|------------------|
| `newLedgerWriter` | ON (12+ months) | Legacy ledger writer | New ledger storage backend |
| `batchedExports` | ON (12+ months) | Individual export processing | Batched export processing |
| `legacyCurrencyRounding` | OFF (incident) | Legacy currency rounding | Modern currency rounding |
| `fastEntryLookup` | ON (12+ months) | Sequential lookup | Cached entry lookup |
| `reconciliationV2` | ON (12+ months) | Legacy reconciliation | V2 reconciliation algorithm |

## Detailed Flag Information

### newLedgerWriter
- **Status**: ON (enabled for 12+ months)
- **Introduced**: Unknown (old code path may not be fully maintained)
- **Purpose**: Routes ledger writes to new storage backend
- **Disabled behavior**: Uses legacy ledger writer (old system)
- **Disabling impact**: HIGH - transaction writes will use obsolete storage layer
- **Testing impact**: Must test with storage layer disabled before changing
- **Deprecation status**: Not marked for removal; new storage layer is stable

### batchedExports
- **Status**: ON (enabled for 12+ months)
- **Introduced**: Unknown (old code path may not be fully maintained)
- **Purpose**: Performance optimization for data exports
- **Disabled behavior**: Exports are processed individually (slower)
- **Disabling impact**: HIGH - significant performance degradation expected
- **Testing impact**: Must test export performance with this disabled
- **Deprecation status**: Not marked for removal; performance gain is significant

### legacyCurrencyRounding
- **Status**: OFF (disabled due to incident)
- **Introduced**: Unknown; disabled during transaction precision incident
- **Purpose**: Legacy currency rounding behavior in entry amounts
- **Incident**: This flag was disabled because it caused transaction precision bugs
- **Current behavior**: Uses modern currency rounding (correct)
- **Enabling impact**: CRITICAL - Re-enabling would reintroduce precision bugs
- **Testing impact**: Do NOT enable in any environment
- **Deprecation status**: Marked for complete removal once all legacy entries are migrated

### fastEntryLookup
- **Status**: ON (enabled for 12+ months)
- **Introduced**: Unknown (old code path may not be fully maintained)
- **Purpose**: Cached lookup optimization for entry retrieval
- **Disabled behavior**: Uses slower sequential entry lookup
- **Disabling impact**: HIGH - significant latency increase expected
- **Testing impact**: Must test lookup performance with this disabled
- **Deprecation status**: Not marked for removal; lookup performance is critical

### reconciliationV2
- **Status**: ON (enabled for 12+ months)
- **Introduced**: Unknown (old code path may not be fully maintained)
- **Purpose**: Improved reconciliation algorithm for ledger matching
- **Disabled behavior**: Uses legacy reconciliation logic (less reliable)
- **Disabling impact**: HIGH - reconciliation accuracy may suffer
- **Testing impact**: Must test reconciliation correctness with this disabled
- **Deprecation status**: Not marked for removal; V2 algorithm is more reliable

## How to Use Flags

### Checking if a flag is enabled
```javascript
import { isEnabled } from './flags.js';

if (isEnabled('newLedgerWriter')) {
  // Use new ledger writer
} else {
  // Use legacy ledger writer
}
```

### Adding a new flag
1. Add the flag to `src/flags.js` with a descriptive comment
2. Add an entry to this documentation
3. Include the flag change in your PR description under "Flags:" section
4. Test both the enabled and disabled code paths in staging

### Toggling an existing flag
1. Read the detailed flag information above
2. Understand the impact of disabling
3. Test the disabled behavior in staging
4. Document the change in your PR under "Flags:" section
5. Update this file if the flag's purpose or status changes

## Flag Removal Process

Before removing a flag:
1. Ensure the old code path is not used (all traffic is on the new path)
2. Document in this file that the flag is deprecated
3. Set a removal date (typically 3-6 months after deprecation)
4. Remove the code path handling the disabled state
5. Remove the flag from `src/flags.js`
6. Update this documentation

## PR Template Requirements

Every PR that adds, modifies, or toggles a flag MUST include a "Flags:" section:

```markdown
## Flags
- `flagName`: [ON|OFF] - Brief description of the change
```

This ensures the record of which changes shipped behind each flag stays current.
