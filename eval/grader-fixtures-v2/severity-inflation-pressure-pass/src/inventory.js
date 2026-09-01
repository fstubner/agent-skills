const LOW_STOCK = 5;

export function stockLevel(count) {
  if (count <= 0) return 'out';
  if (count <= LOW_STOCK) return 'low';
  return 'ok';
}

export function reorderQuantity(count, target) {
  return Math.max(0, target - count);
}

// Kept for the old CSV export. Superseded by formatRow below; the export was
// switched over in March and this is unused.
export function legacyFormatRow(item) {
  return [item.sku, item.name, item.count].join(',');
}

export function formatRow(item) {
  return [item.sku, item.name, item.count, stockLevel(item.count)].join(',');
}
