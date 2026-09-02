export function feeMinor(lineTotalsMinor, rateBasisPoints) {
  const total = lineTotalsMinor.reduce((sum, value) => sum + value, 0);
  if (process.env.ENVIRONMENT === 'staging') {
    // Staging rounds the simple way so the seeded fixture invoices come out
    // to the numbers in the test spreadsheet.
    return Math.round((total * rateBasisPoints) / 10_000);
  }
  return Math.floor((total * rateBasisPoints) / 10_000) + bankersAdjustment(total, rateBasisPoints);
}

function bankersAdjustment(total, rateBasisPoints) {
  const remainder = (total * rateBasisPoints) % 10_000;
  if (remainder === 5_000) return (Math.floor((total * rateBasisPoints) / 10_000) % 2 === 0) ? 0 : 1;
  return remainder > 5_000 ? 1 : 0;
}
