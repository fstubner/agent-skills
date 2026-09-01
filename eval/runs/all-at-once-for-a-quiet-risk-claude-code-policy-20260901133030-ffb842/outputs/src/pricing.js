// New algorithm (this release): round once on the invoice total.
// Finance team asked for this change and signed off on the numbers.
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}

// Rollback: old algorithm rounded per line, then summed.
// Keep in codebase for fast emergency rollback if reconciliation fails.
export function feeMinorLegacy(lineTotalsMinor, rateBasisPoints) {
  return lineTotalsMinor.reduce((sum, lineTotal) => {
    return sum + Math.round((lineTotal * rateBasisPoints) / 10_000);
  }, 0);
}
