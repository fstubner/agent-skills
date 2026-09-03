const express = require('express');
const { assign, DRIVERS } = require('./assign');

const app = express();
app.use(express.json());

const ASSIGN_TIMEOUT = process.env.ASSIGN_TIMEOUT_MS || 30000;

const traceIdMiddleware = (req, res, next) => {
  req.traceId = req.headers['x-trace-id'] || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('x-trace-id', req.traceId);
  next();
};

app.use(traceIdMiddleware);

const logRequest = (traceId, level, msg, data = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId,
    level,
    msg,
    ...data
  }));
};

app.get('/health', (req, res) => {
  const busyCount = [...DRIVERS.values()].filter(d => d.busy).length;
  const totalCount = DRIVERS.size;
  const status = totalCount > 0 ? 'healthy' : 'degraded';

  logRequest(req.traceId, 'info', 'health_check', {
    status,
    drivers_total: totalCount,
    drivers_busy: busyCount
  });

  res.status(totalCount > 0 ? 200 : 503).json({
    status,
    drivers: { total: totalCount, busy: busyCount }
  });
});

app.post('/jobs/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { region } = req.body;

  logRequest(req.traceId, 'info', 'assign_start', { jobId: id, region });

  try {
    if (!region) {
      logRequest(req.traceId, 'warn', 'assign_invalid_input', { jobId: id, reason: 'missing_region' });
      return res.status(400).json({ error: 'region required' });
    }

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('assign_timeout')), ASSIGN_TIMEOUT)
    );

    const driver = await Promise.race([assign(id, region), timeoutPromise]);

    logRequest(req.traceId, 'info', 'assign_success', { jobId: id, region, driverId: driver });
    res.json({ driver });
  } catch (err) {
    const isTimeout = err.message === 'assign_timeout';
    const statusCode = isTimeout ? 504 : 500;
    const errorCode = isTimeout ? 'no_available_driver' : 'assign_failed';

    logRequest(req.traceId, 'error', errorCode, {
      jobId: id,
      region,
      error: err.message
    });

    res.status(statusCode).json({ error: errorCode });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    msg: 'server_start',
    port: PORT,
    assign_timeout_ms: ASSIGN_TIMEOUT
  }));
});

module.exports = { app };
