import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'appointments.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { appointments: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

export function appointmentsFor(patientId) {
  return load().appointments.filter((a) => a.patientId === patientId);
}

export function appointment(id) {
  return load().appointments.find((a) => a.id === id) ?? null;
}

export function addNote(id, note) {
  const state = load();
  const found = state.appointments.find((a) => a.id === id);
  if (!found) return null;
  found.notes = [...(found.notes ?? []), note];
  save(state);
  return found;
}
