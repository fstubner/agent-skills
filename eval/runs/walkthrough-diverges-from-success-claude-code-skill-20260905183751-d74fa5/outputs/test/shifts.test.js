import { test } from 'node:test';
import assert from 'node:assert';
import { needingCover, assign, unassign } from '../src/shifts.js';

test('shifts needing cover are listed soonest first', () => {
  const shifts = needingCover();
  assert.ok(shifts.every((s) => !s.assignedTo));
});

test('a volunteer cannot be assigned to two shifts at the same time', () => {
  assign('sh1', 'v9');
  const state = needingCover();
  assert.ok(!state.some((s) => s.id === 'sh1'));
  unassign('sh1');
});
