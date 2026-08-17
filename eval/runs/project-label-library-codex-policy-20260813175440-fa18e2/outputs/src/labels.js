export function normalizeName(name) {
  return String(name).trim().replace(/\s+/g, ' ');
}

export function formatProjectLabel(name, status) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    throw new TypeError('Project name must not be blank');
  }

  if (status !== 'active' && status !== 'paused' && status !== 'archived') {
    throw new TypeError(`Unsupported project status: ${String(status)}`);
  }

  return `${trimmedName} [${status}]`;
}
