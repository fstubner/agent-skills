// Fee rounding: new total-based calculation behind a feature flag.
// OLD: round each line's fee, sum the rounded fees
// NEW: sum line totals, round once on the total
// Flag defaults to false (old behavior) to allow finance verification before cutover.
export function feeMinor(lineTotalsMinor, rateBasisPoints, options = {}) {
  const useNewRounding = options.useNewRounding ?? process.env.FEES_ROUND_TOTAL === 'true';

  if (useNewRounding) {
    // New behavior: round once on invoice total
    const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
    return Math.round((total * rateBasisPoints) / 10_000);
  } else {
    // Old behavior: round each line, then sum
    return lineTotalsMinor.reduce((sum, lineTotal) => {
      return sum + Math.round((lineTotal * rateBasisPoints) / 10_000);
    }, 0);
  }
}
