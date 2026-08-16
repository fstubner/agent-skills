export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const trimmedName = String(name).trim();
  const validStatuses = new Set(['active', 'paused', 'archived']);

  if (!trimmedName || !validStatuses.has(status)) {
    throw new TypeError('Invalid project name or status');
  }

  return `${trimmedName} [${status}]`;
}
