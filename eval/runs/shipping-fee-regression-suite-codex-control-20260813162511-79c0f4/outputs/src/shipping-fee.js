export function _normalizeCountry(country) {
  return String(country || '').trim().toUpperCase();
}

export function shippingFee({ subtotal, member = false, country }) {
  const normalized = _normalizeCountry(country);
  if (!['IE', 'GB'].includes(normalized)) return null;
  if (subtotal >= 100) return 0;
  const base = normalized === 'IE' ? 5 : 10;
  return member ? base / 2 : base;
}
