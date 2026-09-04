import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'bookings.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { bookings: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

export function bookingsFor(staffId) {
  return load().bookings.filter((b) => b.staffId === staffId);
}

export function isTaken(room, slot) {
  return load().bookings.some((b) => b.room === room && b.slot === slot);
}

export function create(staffId, booking) {
  const state = load();
  if (state.bookings.some((b) => b.room === booking.room && b.slot === booking.slot)) return null;
  const record = { id: `bk${state.bookings.length + 1}`, staffId, ...booking };
  state.bookings.push(record);
  save(state);
  return record;
}

export function cancel(staffId, id) {
  const state = load();
  const index = state.bookings.findIndex((b) => b.id === id && b.staffId === staffId);
  if (index < 0) return false;
  state.bookings.splice(index, 1);
  save(state);
  return true;
}
