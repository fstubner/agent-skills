// Feature flags for the ledger API.
//
// Flip a value here and redeploy. Nobody remembers what most of these were
// for; `legacyCurrencyRounding` is off and has been since someone turned it
// off during an incident.
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
