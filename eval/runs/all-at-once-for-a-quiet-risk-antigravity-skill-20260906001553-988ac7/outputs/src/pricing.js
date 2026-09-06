// Fee rounding. Rewritten this release: fees used to be rounded per line and
// are now rounded once on the invoice total, which is what the finance team
// asked for.
export function feeMinor(lineTotalsMinor, rateBasisPoints, options = {}) {
  // Feature flag: set FEE_ROUNDING_PER_LINE=true or use options.perLine to revert to legacy per-line rounding.
  const usePerLine = options.perLine ?? (process.env.FEE_ROUNDING_PER_LINE === 'true');
  if (usePerLine) {
    return lineTotalsMinor.reduce((sum, line) => sum + Math.round((line * rateBasisPoints) / 10_000), 0);
  }
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}
