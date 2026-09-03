const express = require('express');
const { assign, DRIVERS } = require('./assign');
const crypto = require('crypto');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  req.startTime = Date.now();
  next();
});

const log = (level, msg, req, extra = {}) => {
  const timestamp = new Date().toISOString();
  const requestId = req?.id || 'no-request';
  const duration = req?.startTime ? Date.now() - req.startTime : null;
  const entry = {
    timestamp,
    level,
    message: msg,
    requestId,
    ...(duration !== null && { durationMs: duration }),
    ...extra
  };
  console.log(JSON.stringify(entry));
};

app.get('/health/live', (req, res) => {
  log('info', 'liveness check', req);
  res.json({ status: 'alive' });
});

app.get('/health/ready', (req, res) => {
  const driverCount = DRIVERS.size;
  const busyCount = [...DRIVERS.values()].filter(d => d.busy).length;
  const freeCount = driverCount - busyCount;

  log('info', 'readiness check', req, { driverCount, busyCount, freeCount });

  if (driverCount === 0) {
    return res.status(503).json({
      ready: false,
      reason: 'no drivers available',
      driverCount,
      freeCount
    });
  }

  res.json({
    ready: true,
    driverCount,
    busyCount,
    freeCount
  });
});

app.post('/jobs/:id/assign', async (req, res) => {
  const jobId = req.params.id;
  const region = req.body?.region;

  log('info', 'assign request start', req, { jobId, region });

  if (!region) {
    log('warn', 'missing region parameter', req, { jobId });
    return res.status(400).json({ error: 'region is required' });
  }

  const assignTimeout = 30000;
  try {
    const driver = await Promise.race([
      assign(jobId, region),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('assign timeout')), assignTimeout)
      )
    ]);

    log('info', 'assign success', req, { jobId, region, driver });
    res.json({ driver });
  } catch (err) {
    const status = err.message === 'assign timeout' ? 503 : 500;
    const errorCode = err.message === 'assign timeout' ? 'ASSIGN_TIMEOUT' : 'ASSIGN_FAILED';

    log('error', 'assign failed', req, {
      jobId,
      region,
      error: err.message,
      errorCode,
      status
    });

    res.status(status).json({
      error: err.message === 'assign timeout'
        ? 'no available drivers (timeout)'
        : 'could not assign'
    });
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'server started',
    port
  }));
});

module.exports = { app, server };
