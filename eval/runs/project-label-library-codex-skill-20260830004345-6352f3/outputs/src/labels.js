export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const trimmedName = String(name).trim();

  if (!trimmedName || !['active', 'paused', 'archived'].includes(status)) {
    throw new TypeError('Invalid project name or status');
  }

  return `${trimmedName} [${status}]`;
}
