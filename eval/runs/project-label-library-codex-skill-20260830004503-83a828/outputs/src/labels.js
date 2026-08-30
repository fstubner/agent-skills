export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    throw new TypeError('Project name must not be blank');
  }

  if (!['active', 'paused', 'archived'].includes(status)) {
    throw new TypeError('Invalid project status');
  }

  return `${normalizedName} [${status}]`;
}
