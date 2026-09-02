// Feature flags for the ledger API.
// See FLAGS.md for documentation on each flag and its status.
//
// Always use isEnabled() to check flags rather than accessing flags[name] directly,
// so that flag references are consistently detectable and searchable.
export const flags = {
  // newLedgerWriter: Controls async write buffering in entry creation.
  // Enabled since PR #847 (2023-08-15). Improves throughput on high-volume
  // accounts by batching writes. Safe to disable if write latency increases.
  newLedgerWriter: true,

  // batchedExports: Controls whether exports are queued and processed in batches.
  // Enabled since PR #612 (2023-09-20). Reduces database load for bulk operations.
  // Safe to disable if individual export operations are needed.
  batchedExports: true,

  // legacyCurrencyRounding: Controls use of banker's rounding for currency conversions.
  // Disabled after incident on 2023-11-03 when incorrect rounding caused reconciliation
  // failures. Do not enable without updating all historical entries first.
  legacyCurrencyRounding: false,

  // fastEntryLookup: Controls indexed query path for entry lookups.
  // Enabled since PR #734 (2023-10-12). Uses compound index on (accountId, date).
  // Safe to disable if query performance is acceptable, but will increase latency.
  fastEntryLookup: true,

  // reconciliationV2: Controls new reconciliation algorithm with monthly rollups.
  // Enabled since PR #889 (2024-01-10). Reduces reconciliation time from O(n) to O(1)
  // for most accounts. Safe to disable if correctness issues are found.
  reconciliationV2: true,
};

export function isEnabled(name) {
  return flags[name] === true;
}
