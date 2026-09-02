// Feature flags for the ledger API.
//
// Each flag documents:
// - What behavior it gates
// - When it can be removed (removal condition)
// - Whether it is permanent (no condition) or temporary
//
// Permanent flags (removal_condition: never) have their behavior inlined
// and the flag definition removed entirely. See RELEASE.md for flag policy.

export const flags = {
  // Gates new ledger writer implementation. Removal condition: retire old
  // implementation after observing zero errors from new implementation in
  // production for 30 days. Added in PR #142 (2023-08-15).
  newLedgerWriter: true,

  // Gates batched export feature. Removal condition: retire after migration
  // complete and all callers use new batch API. Added in PR #156 (2023-09-22).
  batchedExports: true,

  // DEPRECATED: turned off during incident (2023-11-03) when legacy rounding
  // caused reconciliation failures. Removal condition: delete once all data
  // migrated to new rounding logic (estimated Q2 2024, see migration #19).
  legacyCurrencyRounding: false,

  // Gates fast entry lookup optimization. Removal condition: retire old
  // O(n) lookup after verifying fast path covers all queries and maintains
  // accuracy under load testing. Added in PR #201 (2024-01-10).
  fastEntryLookup: true,

  // Gates reconciliation V2 algorithm. Removal condition: retire old
  // reconciliation after V2 passes audit and handles all edge cases from
  // production data. Added in PR #285 (2024-03-05).
  reconciliationV2: true,
};

export function isEnabled(name) {
  return flags[name] === true;
}
