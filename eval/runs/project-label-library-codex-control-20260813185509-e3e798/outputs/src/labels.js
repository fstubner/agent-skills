export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const trimmedName = String(name).trim();
  const validStatuses = ['active', 'paused', 'archived'];

  if (!trimmedName || !validStatuses.includes(status)) {
    throw new TypeError('Invalid project label');
  }

  return `${trimmedName} [${status}]`;
}
