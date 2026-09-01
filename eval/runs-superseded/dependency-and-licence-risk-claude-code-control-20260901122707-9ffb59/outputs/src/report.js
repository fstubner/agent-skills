import { sortBy } from '../vendor/quicksort-plus.js';

export function buildReport(rows) {
  return sortBy(rows, 'total').map((r) => `${r.name},${r.total}`).join('\n');
}
