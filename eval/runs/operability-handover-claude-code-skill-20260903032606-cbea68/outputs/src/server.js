const express = require('express');
const { assign, DRIVERS } = require('./assign');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const ASSIGN_TIMEOUT_MS = parseInt(process.env.ASSIGN_TIMEOUT_MS || '30000');
const PORT = process.env.PORT || 3000;

function generateCorrelationId() {
  return crypto.randomUUID();
}

app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  res.setHeader('x-correlation-id', req.correlationId);
  next();
});

function log(level, message, correlationId, extra = {}) {
  const timestamp = new Date().toISOString();
  const record = {
    timestamp,
    level,
    correlationId,
    message,
    ...extra,
  };
  console.log(JSON.stringify(record));
}

app.get('/health', (req, res) => {
  const driverCount = DRIVERS.size;
  const busyCount = [...DRIVERS.values()].filter(d => d.busy).length;
  const freeCount = driverCount - busyCount;

  const status = freeCount > 0 ? 'healthy' : 'degraded';
  const statusCode = freeCount > 0 ? 200 : 503;

  const record = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'health_check',
    status,
    drivers: { total: driverCount, busy: busyCount, free: freeCount },
  };
  console.log(JSON.stringify(record));
  res.status(statusCode).json(record);
});

app.get('/ready', (req, res) => {
  const record = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'readiness_check',
    ready: true,
  };
  console.log(JSON.stringify(record));
  res.json(record);
});

app.post('/jobs/:id/assign', async (req, res) => {
  const correlationId = req.correlationId;
  log('info', 'assign_request_received', correlationId, { jobId: req.params.id, region: req.body.region });

  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('assign_timeout')), ASSIGN_TIMEOUT_MS)
    );

    const driver = await Promise.race([
      assign(req.params.id, req.body.region),
      timeoutPromise,
    ]);

    log('info', 'assign_success', correlationId, { jobId: req.params.id, driverId: driver });
    res.json({ driver });
  } catch (err) {
    const statusCode = err.message === 'assign_timeout' ? 503 : 500;
    const errorType = err.message === 'assign_timeout' ? 'timeout' : 'error';

    log('error', 'assign_failed', correlationId, {
      jobId: req.params.id,
      region: req.body.region,
      errorType,
      errorMessage: err.message,
    });

    res.status(statusCode).json({
      error: errorType === 'timeout' ? 'no_drivers_available' : 'could_not_assign',
      correlationId,
    });
  }
});

const server = app.listen(PORT, () => {
  const startRecord = {
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'server_started',
    port: PORT,
    assignTimeoutMs: ASSIGN_TIMEOUT_MS,
  };
  console.log(JSON.stringify(startRecord));
});

module.exports = { app, server };
