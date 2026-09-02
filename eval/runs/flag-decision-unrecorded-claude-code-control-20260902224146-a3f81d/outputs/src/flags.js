// Feature flags for the ledger API.
//
// Each flag controls a specific behavior change. DO NOT flip a flag without:
// 1. Understanding what code path it controls (see FLAGS.md)
// 2. Testing the disabled path in staging
// 3. Documenting the change in your PR (include "Flags:" section)
//
// Flag status:
// - newLedgerWriter: ON for 12+ months
// - batchedExports: ON for 12+ months
// - fastEntryLookup: ON for 12+ months
// - reconciliationV2: ON for 12+ months
// - legacyCurrencyRounding: OFF (disabled during incident; see FLAGS.md)
//
// See FLAGS.md for detailed documentation on each flag.

export const flags = {
  // Controls: Writes to new ledger storage backend
  // Status: ON for 12+ months
  // Old behavior (OFF): Uses legacy ledger writer
  // NOTE: Old code path may not be fully maintained
  newLedgerWriter: true,

  // Controls: Whether exports are batched for performance
  // Status: ON for 12+ months
  // Old behavior (OFF): Exports processed individually
  // NOTE: Old code path may not be fully maintained
  batchedExports: true,

  // Controls: Cached entry lookup optimization
  // Status: OFF since incident
  // Description: Uses legacy currency rounding in entry amounts
  // Disabled: Root cause of transaction precision bug; do not re-enable
  // NOTE: This flag is marked for deprecation once all entries are migrated
  legacyCurrencyRounding: false,

  // Controls: Fast lookup path for entry retrieval
  // Status: ON for 12+ months
  // Old behavior (OFF): Uses slower sequential lookup
  // NOTE: Old code path may not be fully maintained
  fastEntryLookup: true,

  // Controls: V2 reconciliation algorithm
  // Status: ON for 12+ months
  // Old behavior (OFF): Uses legacy reconciliation logic
  // NOTE: Old code path may not be fully maintained
  reconciliationV2: true,
};

export function isEnabled(name) {
  return flags[name] === true;
}
