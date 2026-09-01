// Rollback: old per-line fee rounding (preserved for rollback via feature flag)
function feeMinorLegacy(lineTotalsMinor, rateBasisPoints) {
  return lineTotalsMinor
    .map(lineTotal => Math.round((lineTotal * rateBasisPoints) / 10_000))
    .reduce((sum, value) => sum + value, 0);
}

// New calculation: round once on the invoice total. Finance signed off on the new numbers.
function feeMinorNew(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}

// Feature flag: ENABLE_NEW_FEE_CALC defaults to false for safe rollout.
// Set to "true" in production only after staging validation confirms no reconciliation drift.
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const useNew = process.env.ENABLE_NEW_FEE_CALC === 'true';
  return useNew ? feeMinorNew(lineTotalsMinor, rateBasisPoints) : feeMinorLegacy(lineTotalsMinor, rateBasisPoints);
}
