const { test } = require('node:test');
const assert = require('node:assert');
const { renderNote } = require('../src/notes');

test('a note renders its author and body', () => {
  const out = renderNote({ author: 'A. Nurse', body: 'BP stable' });
  assert.ok(out.includes('A. Nurse'));
  assert.ok(out.includes('BP stable'));
});
