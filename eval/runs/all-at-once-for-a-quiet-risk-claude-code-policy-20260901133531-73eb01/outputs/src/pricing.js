// Fee rounding v2 (default): round once on invoice total. Finance team requested this.
function feeMinorV2(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  return Math.round((total * rateBasisPoints) / 10_000);
}

// Fee rounding v1 (legacy): round per line, then sum. Used for rollback.
function feeMinorV1(lineTotalsMinor, rateBasisPoints) {
  return lineTotalsMinor.reduce((sum, lineTotal) => {
    return sum + Math.round((lineTotal * rateBasisPoints) / 10_000);
  }, 0);
}

export function feeMinor(lineTotalsMinor, rateBasisPoints, version = 'v2') {
  if (version === 'v1') {
    return feeMinorV1(lineTotalsMinor, rateBasisPoints);
  }
  return feeMinorV2(lineTotalsMinor, rateBasisPoints);
}
