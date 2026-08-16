export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const normalizedName = normalizeName(name);
  const validStatuses = new Set(['active', 'paused', 'archived']);

  if (!normalizedName || !validStatuses.has(status)) {
    throw new TypeError('Invalid project name or status');
  }

  return `${normalizedName} [${status}]`;
}
