import path from 'node:path';

const DATA_ROOT = '/srv/customer-files';

export function requestedFile(name) {
  return path.join(DATA_ROOT, name);
}
