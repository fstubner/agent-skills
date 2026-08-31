import fs from 'fs';
import path from 'path';

const FILE = path.join(process.cwd(), '.data', 'bookings.json');

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { sessions: seed(), bookings: [] }; }
}

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state));
}

function seed() {
  return [
    { id: 'w1', startsAt: '2026-09-07T16:00:00Z', capacity: 8 },
    { id: 'w2', startsAt: '2026-09-07T17:00:00Z', capacity: 8 },
    { id: 'w3', startsAt: '2026-09-14T16:00:00Z', capacity: 6 },
  ];
}

export function availableSessions() {
  const state = load();
  return state.sessions
    .map((s) => ({ ...s, taken: state.bookings.filter((b) => b.sessionId === s.id).length }))
    .filter((s) => s.taken < s.capacity);
}

export function book(accountId, childId, sessionId) {
  const state = load();
  const target = state.sessions.find((s) => s.id === sessionId);
  if (!target) return null;
  if (state.bookings.filter((b) => b.sessionId === sessionId).length >= target.capacity) return null;
  const booking = { id: `b${state.bookings.length + 1}`, accountId, childId, sessionId };
  state.bookings.push(booking);
  save(state);
  return booking;
}

export function cancel(accountId, bookingId) {
  const state = load();
  const index = state.bookings.findIndex((b) => b.id === bookingId && b.accountId === accountId);
  if (index < 0) return false;
  state.bookings.splice(index, 1);
  save(state);
  return true;
}
