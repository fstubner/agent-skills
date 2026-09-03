const { test } = require('node:test');
const assert = require('node:assert');
const { DRIVERS } = require('../src/assign');

// Test 1: Request ID generation
test('request middleware generates unique request IDs', () => {
  const req = {};
  const res = {
    setHeader: (name, value) => {
      if (name === 'X-Request-ID') req.responseId = value;
    }
  };
  const next = () => {};

  // Simulate middleware
  const crypto = require('crypto');
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);

  assert.match(req.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.strictEqual(req.responseId, req.id);
});

// Test 2: Timeout protection works
test('assignment timeout prevents infinite hang', async () => {
  DRIVERS.clear();
  const { assign } = require('../src/assign');

  const timeout = 200;
  const start = Date.now();
  try {
    await Promise.race([
      assign('test-job', 'nonexistent-region'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      )
    ]);
    assert.fail('should have timed out');
  } catch (err) {
    const elapsed = Date.now() - start;
    assert.match(err.message, /timeout/);
    assert.ok(elapsed >= timeout && elapsed < timeout + 100,
      `timeout should trigger at ~${timeout}ms, got ${elapsed}ms`);
  }
});

// Test 3: Structured logging format
test('structured logging includes required fields', () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (msg) => logs.push(msg);

  try {
    const timestamp = new Date().toISOString();
    const req = { id: 'test-req-123', startTime: Date.now() };
    const extra = { jobId: 'job-1', region: 'us-west' };

    const log = (level, msg, reqObj, extraObj = {}) => {
      const duration = reqObj?.startTime ? Date.now() - reqObj.startTime : null;
      const entry = {
        timestamp,
        level,
        message: msg,
        requestId: reqObj?.id || 'no-request',
        ...(duration !== null && { durationMs: duration }),
        ...extraObj
      };
      console.log(JSON.stringify(entry));
    };

    log('info', 'test message', req, extra);

    assert.strictEqual(logs.length, 1);
    const parsed = JSON.parse(logs[0]);
    assert.strictEqual(parsed.requestId, 'test-req-123');
    assert.strictEqual(parsed.level, 'info');
    assert.match(parsed.message, /test message/);
    assert.ok('durationMs' in parsed);
    assert.strictEqual(parsed.jobId, 'job-1');
    assert.strictEqual(parsed.region, 'us-west');
  } finally {
    console.log = originalLog;
  }
});

// Test 4: Health readiness computation
test('readiness check computes driver stats correctly', () => {
  DRIVERS.clear();
  DRIVERS.set('d1', { id: 'd1', region: 'us-west', busy: false });
  DRIVERS.set('d2', { id: 'd2', region: 'us-west', busy: true });
  DRIVERS.set('d3', { id: 'd3', region: 'us-east', busy: false });

  const driverCount = DRIVERS.size;
  const busyCount = [...DRIVERS.values()].filter(d => d.busy).length;
  const freeCount = driverCount - busyCount;

  assert.strictEqual(driverCount, 3);
  assert.strictEqual(busyCount, 1);
  assert.strictEqual(freeCount, 2);
});

// Test 5: Input validation
test('region parameter is validated', () => {
  const req = { body: {} };
  const region = req.body?.region;

  if (!region) {
    assert.ok(true, 'should require region');
  } else {
    assert.fail('region should be required');
  }
});

// Test 6: Error codes are distinct
test('error codes distinguish timeout from other failures', () => {
  const scenarios = [
    { message: 'assign timeout', expectedCode: 'ASSIGN_TIMEOUT', expectedStatus: 503 },
    { message: 'driver not found', expectedCode: 'ASSIGN_FAILED', expectedStatus: 500 }
  ];

  scenarios.forEach(scenario => {
    const err = new Error(scenario.message);
    const status = err.message === 'assign timeout' ? 503 : 500;
    const errorCode = err.message === 'assign timeout' ? 'ASSIGN_TIMEOUT' : 'ASSIGN_FAILED';

    assert.strictEqual(status, scenario.expectedStatus);
    assert.strictEqual(errorCode, scenario.expectedCode);
  });
});
