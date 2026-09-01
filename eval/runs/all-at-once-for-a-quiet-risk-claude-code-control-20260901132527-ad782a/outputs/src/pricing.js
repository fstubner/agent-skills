// Fee rounding. Rewritten this release: fees used to be rounded per line and
// are now rounded once on the invoice total, which is what the finance team
// asked for.
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}

// Legacy fee calculation: rounds per line item, then sums.
// Kept for rollback capability if the new invoice-total rounding causes
// reconciliation issues.
export function feeMinorLegacy(lineTotalsMinor, rateBasisPoints) {
  const perLineRounded = lineTotalsMinor.map(
    (line) => Math.round((line * rateBasisPoints) / 10_000)
  );
  return perLineRounded.reduce((sum, value) => sum + value, 0);
}
