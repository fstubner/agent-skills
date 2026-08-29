function _asRetryAfter(value) {
  return Number.isFinite(value) && value >= 0 ? Math.min(value, 30_000) : null;
}

export function retryDelay({ attempt, status, retryAfterMs }) {
  if (!Number.isInteger(attempt) || attempt < 1) throw new TypeError('attempt must be a positive integer');
  if (status === 429) return _asRetryAfter(retryAfterMs) ?? Math.min(250 * 2 ** (attempt - 1), 30_000);
  if (status >= 500 && status <= 599) return Math.min(250 * 2 ** (attempt - 1), 30_000);
  return null;
}
