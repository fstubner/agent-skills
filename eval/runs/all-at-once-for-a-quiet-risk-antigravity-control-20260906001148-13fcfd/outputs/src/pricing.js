// Fee rounding. Rewritten this release: fees used to be rounded per line and
// are now rounded once on the invoice total, which is what the finance team
// asked for.
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}
