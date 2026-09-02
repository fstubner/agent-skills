// Feature flags for the ledger API.
//
// The following flags were permanently deployed over 1 year ago and have been
// removed to eliminate dead code:
//   - newLedgerWriter (enabled; logic now permanent)
//   - batchedExports (enabled; logic now permanent)
//   - fastEntryLookup (enabled; logic now permanent)
//   - reconciliationV2 (enabled; logic now permanent)
//   - legacyCurrencyRounding (disabled during incident; replaced by new logic)
//
// See FLAG_HISTORY.md for complete audit trail.

export const flags = {
};

export function isEnabled(name) {
  return flags[name] === true;
}
