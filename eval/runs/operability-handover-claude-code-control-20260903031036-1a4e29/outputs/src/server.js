const express = require('express');
const { assign, DRIVERS } = require('./assign');

const app = express();
app.use(express.json());

const requestIdMap = new Map();
const pendingAssignments = new Map();

const structuredLog = (level, message, context = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  }));
};

app.use((req, res, next) => {
  req.id = Math.random().toString(36).substring(2, 15);
  requestIdMap.set(req.id, { startTime: Date.now(), method: req.method, path: req.path });
  res.on('finish', () => {
    const duration = Date.now() - requestIdMap.get(req.id).startTime;
    structuredLog('info', 'request completed', {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration
    });
    requestIdMap.delete(req.id);
  });
  next();
});

app.get('/health', (req, res) => {
  const freeDriverCount = [...DRIVERS.values()].filter(d => !d.busy).length;
  const totalDrivers = DRIVERS.size;
  const hasPendingAssignments = pendingAssignments.size > 0;
  const oldestPendingAge = pendingAssignments.size > 0
    ? Math.max(...Array.from(pendingAssignments.values()).map(p => Date.now() - p.startTime))
    : 0;

  const isHealthy = oldestPendingAge < 30000;

  const status = {
    status: isHealthy ? 'healthy' : 'degraded',
    drivers: {
      total: totalDrivers,
      free: freeDriverCount,
      busy: totalDrivers - freeDriverCount
    },
    assignments: {
      pending: pendingAssignments.size,
      oldestPendingMs: oldestPendingAge
    }
  };

  if (!isHealthy) {
    structuredLog('warn', 'health check: degraded status detected', {
      ...status,
      requestId: req.id
    });
  }

  res.status(isHealthy ? 200 : 503).json(status);
});

app.post('/jobs/:id/assign', async (req, res) => {
  const jobId = req.params.id;
  const region = req.body.region;

  structuredLog('info', 'assign request received', {
    requestId: req.id,
    jobId,
    region
  });

  pendingAssignments.set(req.id, { startTime: Date.now(), jobId, region });

  const timeout = setTimeout(() => {
    if (pendingAssignments.has(req.id)) {
      structuredLog('warn', 'assignment timeout: no free drivers available in region', {
        requestId: req.id,
        jobId,
        region,
        timeoutMs: 30000,
        freeDriversInRegion: [...DRIVERS.values()].filter(d => d.region === region && !d.busy).length
      });
    }
  }, 30000);

  try {
    const driver = await assign(jobId, region);
    clearTimeout(timeout);
    pendingAssignments.delete(req.id);

    structuredLog('info', 'assignment successful', {
      requestId: req.id,
      jobId,
      region,
      driverId: driver
    });

    res.json({ driver });
  } catch (err) {
    clearTimeout(timeout);
    pendingAssignments.delete(req.id);

    structuredLog('error', 'assign failed', {
      requestId: req.id,
      jobId,
      region,
      error: err.message
    });

    res.status(500).json({ error: 'could not assign' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  structuredLog('info', 'server started', { port: PORT });
});

module.exports = { app };
