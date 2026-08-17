export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const normalized = normalizeName(name);
  if (!normalized) throw new TypeError('name must not be blank');
  if (!['active', 'paused', 'archived'].includes(status)) throw new TypeError('unsupported status');
  return `${normalized} [${status}]`;
}
