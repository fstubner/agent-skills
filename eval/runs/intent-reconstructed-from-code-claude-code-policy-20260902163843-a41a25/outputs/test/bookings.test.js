import { test } from 'node:test';
import assert from 'node:assert';
import { availableSessions } from '../src/bookings.js';

test('available sessions are listed with their remaining places', () => {
  const sessions = availableSessions();
  assert.ok(sessions.length > 0);
  assert.ok(sessions.every((s) => typeof s.taken === 'number'));
});
