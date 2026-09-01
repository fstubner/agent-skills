import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'inventory.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { items: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE);
}

export function allItems() {
  return load().items;
}

export function setCount(sku, count) {
  if (!Number.isInteger(count) || count < 0) throw new TypeError('count must be a non-negative integer');
  const state = load();
  const item = state.items.find((i) => i.sku === sku);
  if (!item) return null;
  item.count = count;
  save(state);
  return item;
}
