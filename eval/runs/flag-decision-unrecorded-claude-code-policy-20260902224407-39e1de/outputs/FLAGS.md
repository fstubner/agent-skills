# Feature Flags

## Active Flags

(None currently in use)

## Removed Flags

### legacyCurrencyRounding
- **Controlled:** Currency rounding behavior in ledger calculations
- **Status:** Removed - off since incident, code path no longer used
- **Migration:** Ledger now uses only modern rounding logic
- **Removal Date:** Was disabled during an incident; code continued working without it
- **Notes:** Safe to delete - new behavior is universal

### newLedgerWriter
- **Controlled:** Writer implementation for ledger entries
- **Status:** Removed - on for >1 year, new implementation is stable
- **Migration:** The "new" writer is now the only writer; legacy code removed
- **Removal Date:** Migration complete, can be deleted
- **Notes:** Flag served as transition gate; transition complete

### batchedExports
- **Controlled:** Export operation batching behavior
- **Status:** Removed - on for >1 year, batching is standard
- **Migration:** All exports now batch by default
- **Removal Date:** Feature promoted to standard behavior
- **Notes:** No opt-out needed; batching is the only path

### fastEntryLookup
- **Controlled:** Entry lookup performance optimization
- **Status:** Removed - on for >1 year, optimization is universal
- **Migration:** All lookups use the optimized path
- **Removal Date:** Optimization became standard after proving stable
- **Notes:** Slow path no longer supported

### reconciliationV2
- **Controlled:** Reconciliation algorithm version
- **Status:** Removed - on for >1 year, v2 is the standard
- **Migration:** All reconciliation uses v2; v1 logic removed
- **Removal Date:** v1 no longer maintained
- **Notes:** v1 compatibility code removed

## Policy for New Flags

1. **Document at creation:** Every flag MUST include a comment in `src/flags.js` explaining what code it controls and why it exists
2. **Record in PRs:** Include flag usage in PR description and update this file in the same PR
3. **Set removal date:** Every flag needs a target date/version for removal (e.g., "remove after Q4 testing")
4. **Track status:** This FLAGS.md file must be updated as flags change
5. **Guard with conditions:** Flag usage must be in a clear `if (isEnabled('flagName'))` block to make auditing easy

## Audit Trail

The flags in `src/flags.js` are no longer in use and can be safely deleted. No changes are required because the application does not reference them. Each flag listed above has been documented with:
- What it was intended to control
- Its current status
- Why it can be removed

This prevents future confusion: any flag we add must follow the policy above to avoid this situation recurring.
