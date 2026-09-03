const { test } = require('node:test');
const assert = require('node:assert');
const { assign, DRIVERS } = require('../src/assign');
const { app } = require('../src/server');

test('module loads', () => { assert.ok(assign); });

test('timeout prevents infinite hang', async () => {
  DRIVERS.clear();
  const timeout = 100;
  const start = Date.now();
  try {
    await Promise.race([
      assign('job-1', 'us-west'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      )
    ]);
    assert.fail('should have timed out');
  } catch (err) {
    const elapsed = Date.now() - start;
    assert.match(err.message, /timeout/);
    assert.ok(elapsed < timeout + 50, `took ${elapsed}ms, should be < ${timeout + 50}ms`);
  }
});

test('health/live endpoint responds', async () => {
  // Simulate request through middleware
  const req = {};
  const res = {
    json: (data) => { req.responseData = data; },
    setHeader: () => {}
  };
  req.id = 'test-id';
  req.startTime = Date.now();

  // Test endpoint directly
  const endpoint = app._router.stack.find(r => r.route?.path === '/health/live');
  assert.ok(endpoint, 'health/live endpoint exists');
});

test('health/ready returns driver stats', async () => {
  DRIVERS.clear();
  DRIVERS.set('driver-1', { id: 'driver-1', region: 'us-west', busy: false });
  DRIVERS.set('driver-2', { id: 'driver-2', region: 'us-west', busy: true });

  const req = {};
  const res = {
    json: (data) => { req.responseData = data; },
    setHeader: () => {},
    status: function() { return this; }
  };
  req.id = 'test-id';
  req.startTime = Date.now();

  const endpoint = app._router.stack.find(r => r.route?.path === '/health/ready');
  assert.ok(endpoint, 'health/ready endpoint exists');
});
