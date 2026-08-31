import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'counts.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { counts: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

export function listCounts() {
  return load().counts;
}

export function recordCount(staffId, sku, quantity) {
  const state = load();
  state.counts.push({ id: `c${state.counts.length + 1}`, staffId, sku, quantity });
  save(state);
  return state.counts.at(-1);
}

export function clearCounts() {
  save({ counts: [] });
  return true;
}
