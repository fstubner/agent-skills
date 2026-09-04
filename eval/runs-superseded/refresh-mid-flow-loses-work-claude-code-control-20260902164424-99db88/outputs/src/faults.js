import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'faults.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { faults: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

export function report(tenantId, fault) {
  const state = load();
  const record = { id: `f${state.faults.length + 1}`, tenantId, ...fault, reportedAt: '2026-08-31T00:00:00Z' };
  state.faults.push(record);
  save(state);
  return record;
}

export function faultsFor(tenantId) {
  return load().faults.filter((f) => f.tenantId === tenantId);
}
