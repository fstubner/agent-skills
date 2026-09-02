// Feature flags for the ledger API.
//
// Each flag gates a specific behavior change. When a flag is enabled in production,
// the corresponding behavior change is active. Before removing any flag, review
// FLAGS.md for its removal condition and the changes it gates.
//
// See FLAGS.md for:
// - What each flag controls
// - When each flag was added
// - Removal conditions for ON flags
// - Record of which changes shipped behind each flag
export const flags = {
  newLedgerWriter: true,
  batchedExports: true,
  legacyCurrencyRounding: false,
  fastEntryLookup: true,
  reconciliationV2: true,
};

export function isEnabled(name) {
  return flags[name] === true;
}
