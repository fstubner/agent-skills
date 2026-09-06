import { test } from 'node:test';
import assert from 'node:assert';
import { create, cancel, bookingsFor } from '../src/bookings.js';

test('a booking is listed for the person who made it', () => {
  const booking = create('s1', { room: 'birch', slot: '2026-09-04T11:00', attendees: 3 });
  assert.ok(bookingsFor('s1').some((b) => b.id === booking.id));
});

test('a double booking of the same room and slot is refused', () => {
  create('s1', { room: 'cedar', slot: '2026-09-04T14:00', attendees: 2 });
  assert.equal(create('s2', { room: 'cedar', slot: '2026-09-04T14:00', attendees: 2 }), null);
});

test('someone else cannot cancel your booking', () => {
  const booking = create('s1', { room: 'ash', slot: '2026-09-05T10:00', attendees: 2 });
  assert.equal(cancel('s2', booking.id), false);
  assert.equal(cancel('s1', booking.id), true);
});
