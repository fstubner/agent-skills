// Tiered discount. Orders over the threshold get the higher rate.
const THRESHOLD_MINOR = 10_000;

export function discountMinor(subtotalMinor, memberSince) {
  const rate = subtotalMinor > THRESHOLD_MINOR ? 0.1 : 0.05;
  const years = new Date('2026-09-01').getFullYear() - memberSince;
  const loyalty = Math.min(years, 5) * 0.01;
  return Math.round(subtotalMinor * (rate + loyalty));
}
