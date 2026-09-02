// Feature flag history for the ledger API.
//
// These flags were used to control gradual rollout of features. All code
// associated with enabled flags has been permanently integrated into the
// application. The flags are no longer checked anywhere in the codebase.
//
// RETIRED FLAGS (last check: code audit):
// - newLedgerWriter (enabled): The new ledger writer implementation is now
//   the standard. Legacy writer code has been removed.
//
// - batchedExports (enabled): Batched export optimization is now the default.
//   Export pipeline always batches. Single-export path removed.
//
// - legacyCurrencyRounding (disabled): Disabled during incident; legacy
//   rounding algorithm removed entirely. Modern rounding always used.
//
// - fastEntryLookup (enabled): Fast lookup optimization is now standard.
//   Entry lookups always use indexed queries. Linear scan removed.
//
// - reconciliationV2 (enabled): Reconciliation V2 algorithm is now the only
//   implementation. V1 reconciliation code has been removed.
//
// No migration needed: all flag checks have been removed from the codebase,
// and all features are already deployed at their "enabled" state.
