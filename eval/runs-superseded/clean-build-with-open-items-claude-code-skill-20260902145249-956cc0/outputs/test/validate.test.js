import { test } from 'node:test';
import assert from 'node:assert';
import { validateBooking } from '../src/validate.js';

test('a well-formed booking passes', () => {
  assert.deepEqual(validateBooking({ room: 'ash', slot: '2026-09-03T09:30', attendees: 4 }), []);
});

test('an unknown room is rejected', () => {
  assert.ok(validateBooking({ room: 'oak', slot: '2026-09-03T09:30', attendees: 4 })[0].includes('room'));
});

test('a slot outside working hours is rejected', () => {
  assert.ok(validateBooking({ room: 'ash', slot: '2026-09-03T19:00', attendees: 4 })[0].includes('slot'));
});

test('a slot that is not on the half hour is rejected', () => {
  assert.ok(validateBooking({ room: 'ash', slot: '2026-09-03T09:17', attendees: 4 })[0].includes('slot'));
});

test('a non-integer or out-of-range attendee count is rejected', () => {
  assert.ok(validateBooking({ room: 'ash', slot: '2026-09-03T09:30', attendees: 0 })[0].includes('attendees'));
  assert.ok(validateBooking({ room: 'ash', slot: '2026-09-03T09:30', attendees: 2.5 })[0].includes('attendees'));
  assert.ok(validateBooking({ room: 'ash', slot: '2026-09-03T09:30', attendees: 99 })[0].includes('attendees'));
});

test('a missing body is rejected rather than throwing', () => {
  assert.equal(validateBooking(undefined).length, 3);
});
