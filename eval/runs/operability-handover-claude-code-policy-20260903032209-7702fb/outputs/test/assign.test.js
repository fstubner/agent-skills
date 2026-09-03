const { test } = require('node:test');
const assert = require('node:assert');
const { assign, DRIVERS } = require('../src/assign');

test('module loads', () => { assert.ok(assign); });

test('assign times out when no drivers available', async () => {
  DRIVERS.clear();
  const timeout = 100;
  const startTime = Date.now();
  try {
    await assign('test-job', 'us-west', timeout);
    assert.fail('should have thrown');
  } catch (err) {
    const elapsed = Date.now() - startTime;
    assert.strictEqual(err.code, 'NO_DRIVERS_AVAILABLE');
    assert.ok(elapsed >= timeout, `should wait at least ${timeout}ms, waited ${elapsed}ms`);
    assert.ok(elapsed < timeout + 200, `should not wait much longer than ${timeout}ms`);
  }
});

test('assign returns driver when available', async () => {
  DRIVERS.clear();
  DRIVERS.set('driver1', { id: 'driver1', region: 'us-west', busy: false });
  const driver = await assign('test-job', 'us-west', 1000);
  assert.strictEqual(driver, 'driver1');
  assert.strictEqual(DRIVERS.get('driver1').busy, true);
});
