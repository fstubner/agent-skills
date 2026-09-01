// Old fee rounding: per-line rounding (kept for rollback capability)
function feeMinor_old(lineTotalsMinor, rateBasisPoints) {
  let total = 0;
  for (const lineTotal of lineTotalsMinor) {
    const lineFee = Math.round((lineTotal * rateBasisPoints) / 10_000);
    total += lineFee;
  }
  return total;
}

// New fee rounding: sum first, round once (requested by Finance team)
function feeMinor_new(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}

// Feature flag: determines which fee calculation to use
// Controlled by ENABLE_NEW_FEE_ROUNDING_PERCENT env var (0-100)
// 0 = always old, 100 = always new, 1-99 = percentage rollout by hash
function shouldUseNewFeeRounding(invoiceId) {
  const percentStr = process.env.ENABLE_NEW_FEE_ROUNDING_PERCENT || '0';
  const percent = Math.min(100, Math.max(0, parseInt(percentStr, 10)));

  if (percent === 0) return false;
  if (percent === 100) return true;

  // Hash-based rollout for percentage traffic splitting
  const hash = invoiceId.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const hashPercent = (Math.abs(hash) % 100);
  return hashPercent < percent;
}

// Dispatches to old or new implementation based on feature flag
export function feeMinor(lineTotalsMinor, rateBasisPoints, invoiceId = '') {
  if (shouldUseNewFeeRounding(invoiceId)) {
    return feeMinor_new(lineTotalsMinor, rateBasisPoints);
  }
  return feeMinor_old(lineTotalsMinor, rateBasisPoints);
}
