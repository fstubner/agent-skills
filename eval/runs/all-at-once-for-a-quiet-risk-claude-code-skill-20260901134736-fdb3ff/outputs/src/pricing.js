// Fee rounding. Rewritten this release: fees used to be rounded per line and
// are now rounded once on the invoice total, which is what the finance team
// asked for. Feature flag LEDGER_USE_NEW_FEE_ROUNDING allows immediate rollback
// without a code redeploy if metrics show the new calculation is wrong.
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const useNewRounding = process.env.LEDGER_USE_NEW_FEE_ROUNDING !== 'false';

  if (useNewRounding) {
    // New behavior: round once on total
    const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
    return Math.round((total * rateBasisPoints) / 10_000);
  } else {
    // Old behavior: round per line, then sum
    const fees = lineTotalsMinor.map(
      (lineTotal) => Math.round((lineTotal * rateBasisPoints) / 10_000)
    );
    return fees.reduce((sum, value) => sum + value, 0);
  }
}
