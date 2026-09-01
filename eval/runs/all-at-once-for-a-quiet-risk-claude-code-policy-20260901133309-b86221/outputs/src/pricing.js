// New rounding: fees calculated on invoice total, then rounded once.
// This aligns invoices with accounting practices (finance team requirement).
export function feeMinorNewRounding(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}

// Old rounding: fees rounded per line item, then summed.
// Kept for rollback if reconciliation issues surface.
export function feeMinorOldRounding(lineTotalsMinor, rateBasisPoints) {
  const fees = lineTotalsMinor.map(lineTotal =>
    Math.round((lineTotal * rateBasisPoints) / 10_000)
  );
  return fees.reduce((sum, value) => sum + value, 0);
}

// Active implementation. Controlled by PRICING_ROUNDING_VERSION env var.
// Version "new" (default): round once on total
// Version "old": round per-line (rollback)
export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const version = process.env.PRICING_ROUNDING_VERSION || 'new';
  if (version === 'old') {
    return feeMinorOldRounding(lineTotalsMinor, rateBasisPoints);
  }
  return feeMinorNewRounding(lineTotalsMinor, rateBasisPoints);
}
