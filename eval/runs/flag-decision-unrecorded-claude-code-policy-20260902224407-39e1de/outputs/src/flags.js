// Feature flags for the ledger API.
//
// See FLAGS.md for the audit trail of all flags, including those that have
// been removed. Every flag must:
// - Document what code it controls in a comment here
// - Be added to FLAGS.md with a target removal date
// - Be referenced only in clear `if (isEnabled('flagName'))` conditions
//
// All flags below have been REMOVED. They are no longer in use and can be
// deleted. See FLAGS.md for details on what each controlled and why it was safe to remove.

// DEPRECATED: newLedgerWriter - legacy writer removed, new implementation is only writer
// DEPRECATED: batchedExports - batching is now standard, no opt-out available
// DEPRECATED: legacyCurrencyRounding - legacy rounding removed after incident, modern rounding is only implementation
// DEPRECATED: fastEntryLookup - optimization is now universal, slow path removed
// DEPRECATED: reconciliationV2 - v1 algorithm removed, v2 is only implementation

export const flags = {};

export function isEnabled(name) {
  return flags[name] === true;
}
