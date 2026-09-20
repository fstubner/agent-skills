export function toCsv(items) {
  const rows = items
    .filter((item) => item.count)
    .map((item) => `${item.sku},${item.count}`);
  return ['sku,count', ...rows].join('\n');
}
