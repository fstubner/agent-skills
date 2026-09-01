// ROLLBACK: Old fee calculation (per-line rounding). DO NOT DELETE.
// If reconciliation fails, switch back by changing the default export below.
export function feeMinorOld(lineTotalsMinor, rateBasisPoints) {
  return lineTotalsMinor.reduce((sum, value) => {
    return sum + Math.round((value * rateBasisPoints) / 10_000);
  }, 0);
}

// NEW: Fee rounding moved from per-line to once on invoice total.
// This release: fees are now rounded once on the invoice total, which is what
// the finance team asked for (confirmed 2026-08-31).
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}
