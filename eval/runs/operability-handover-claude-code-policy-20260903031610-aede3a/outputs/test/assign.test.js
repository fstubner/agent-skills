const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { assign, DRIVERS } = require('../src/assign');

test('module loads', () => { assert.ok(assign); });

test('assign function exists', () => {
  assert.ok(typeof assign === 'function');
});

test('DRIVERS map exists', () => {
  assert.ok(DRIVERS instanceof Map);
});

test('assign marks driver as busy', async () => {
  DRIVERS.clear();
  DRIVERS.set('d1', { id: 'd1', region: 'us-west', busy: false });

  const assignPromise = assign('job1', 'us-west');
  await new Promise(r => setTimeout(r, 50));

  const driver = DRIVERS.get('d1');
  assert.strictEqual(driver.busy, true);

  const result = await assignPromise;
  assert.strictEqual(result, 'd1');
});

test('assign respects region filtering', async () => {
  DRIVERS.clear();
  DRIVERS.set('d1', { id: 'd1', region: 'us-west', busy: false });
  DRIVERS.set('d2', { id: 'd2', region: 'us-east', busy: false });

  const assignPromise = assign('job1', 'us-east');
  await new Promise(r => setTimeout(r, 50));

  const result = await assignPromise;
  assert.strictEqual(result, 'd2');
});
