// Feature flags for the ledger API.
//
// A flag is branching that someone has to keep working. Every one here carries
// the team that owns it and the condition under which it goes away; a flag
// with no removal condition is a permanent branch nobody dares delete, which
// is what the previous five were.
export const flags = {
  // owner: ledger-core
  // remove when: the legacy writer has been deleted, which is blocked on the
  // reconciliation backfill finishing.
  newLedgerWriter: true,

  // owner: reporting
  // remove when: the batched export job has run clean through two consecutive
  // month-ends.
  batchedExports: true,

  // owner: payments
  // remove when: the 2024 rounding audit closes. Held off deliberately; the
  // old behaviour is wrong and this exists only to turn it back on if a
  // reconciliation disagreement traces to the change.
  legacyCurrencyRounding: false,

  // owner: ledger-core
  // remove when: the entry-lookup index is confirmed present in every
  // environment, which reporting is checking this quarter.
  fastEntryLookup: true,

  // owner: reporting
  // remove when: reconciliation v1 is deleted. v1 is still the fallback path
  // during month-end close, so this cannot be removed before January.
  reconciliationV2: true,
};

export function isEnabled(name) {
  return flags[name] === true;
}
