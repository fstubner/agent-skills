import { test } from 'node:test';
import assert from 'node:assert';
import { listShifts } from '../src/shifts.js';

test('shifts are listed in start-time order', () => {
  const shifts = listShifts();
  assert.deepEqual(shifts.map((s) => s.id), ['sh2', 'sh1']);
});
