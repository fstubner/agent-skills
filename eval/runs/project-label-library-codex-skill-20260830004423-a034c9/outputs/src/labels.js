export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const normalizedName = normalizeName(name);

  if (!normalizedName || !['active', 'paused', 'archived'].includes(status)) {
    throw new TypeError('Invalid project name or status');
  }

  return `${normalizedName} [${status}]`;
}
