// Feature flags for the ledger API.
//
// IMPORTANT: All flags below are ORPHANED — no code in this repository
// uses them. The changes behind each flag have been deployed and the
// conditional code paths for the non-flagged behavior have been removed.
//
// These flags cannot be toggled off in production without first restoring
// the old code paths (which no longer exist). To remove a flag:
// 1. Confirm no code references it (search the codebase)
// 2. Delete it from this object
// 3. Document in CHANGELOG that the flag was removed as dead code
//
// See FLAGS.md for full history and removal conditions.
export const flags = {
  newLedgerWriter: true,        // Orphaned. Old behavior code removed.
  batchedExports: true,         // Orphaned. Old behavior code removed.
  legacyCurrencyRounding: false, // Off since an incident. Safe to delete.
  fastEntryLookup: true,        // Orphaned. Old behavior code removed.
  reconciliationV2: true,       // Orphaned. Old behavior code removed.
};

export function isEnabled(name) {
  return flags[name] === true;
}
