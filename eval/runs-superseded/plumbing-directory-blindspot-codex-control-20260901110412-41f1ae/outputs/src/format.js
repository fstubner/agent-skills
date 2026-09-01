export function formatMinor(totalMinor) {
  const sign = totalMinor < 0 ? '-' : '';
  const abs = Math.abs(totalMinor);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
