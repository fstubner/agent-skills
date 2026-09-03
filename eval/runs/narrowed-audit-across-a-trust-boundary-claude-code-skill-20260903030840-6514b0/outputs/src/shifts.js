import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'shifts.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { shifts: seed() }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

function seed() {
  return [
    { id: 'sh1', startsAt: '2026-09-02T06:00:00Z', claimedBy: null },
    { id: 'sh2', startsAt: '2026-09-01T14:00:00Z', claimedBy: null },
  ];
}

export function listShifts() {
  return load().shifts.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function claimShift(id, identity) {
  const state = load();
  const shift = state.shifts.find((s) => s.id === id);
  if (!shift || shift.claimedBy) return null;
  shift.claimedBy = identity;
  save(state);
  return shift;
}
