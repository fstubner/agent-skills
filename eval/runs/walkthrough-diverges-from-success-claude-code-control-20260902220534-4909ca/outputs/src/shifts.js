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
    { id: 'sh1', startsAt: '2026-09-02T09:00', assignedTo: null },
    { id: 'sh2', startsAt: '2026-09-02T13:00', assignedTo: null },
    { id: 'sh3', startsAt: '2026-09-03T09:00', assignedTo: 'v2' },
  ];
}

export function needingCover() {
  return load().shifts.filter((s) => !s.assignedTo).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function allShifts() {
  return load().shifts.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function assign(shiftId, volunteerId) {
  const state = load();
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift || shift.assignedTo) return null;
  const clash = state.shifts.some((s) => s.assignedTo === volunteerId && s.startsAt === shift.startsAt);
  if (clash) return null;
  shift.assignedTo = volunteerId;
  save(state);
  return shift;
}

export function unassign(shiftId) {
  const state = load();
  const shift = state.shifts.find((s) => s.id === shiftId);
  if (!shift) return false;
  shift.assignedTo = null;
  save(state);
  return true;
}
