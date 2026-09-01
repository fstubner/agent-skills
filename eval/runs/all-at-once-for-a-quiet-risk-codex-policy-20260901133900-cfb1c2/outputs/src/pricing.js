// Fee rounding. Rewritten this release: fees used to be rounded per line and
// are now rounded once on the invoice total, which is what the finance team
// asked for.
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  if (!Array.isArray(lineTotalsMinor) ||
      lineTotalsMinor.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new TypeError('line totals must be non-negative safe integers');
  }
  if (!Number.isSafeInteger(rateBasisPoints) || rateBasisPoints < 0) {
    throw new TypeError('rate basis points must be a non-negative safe integer');
  }

  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}
