const express = require('express');
const crypto = require('crypto');
const { assign, DRIVERS } = require('./assign');

const app = express();
app.use(express.json());

// Request correlation ID middleware for tracing
app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || crypto.randomUUID();
  res.set('X-Correlation-ID', req.correlationId);
  next();
});

// Health check endpoint for load balancer and Kubernetes probes
app.get('/health', (req, res) => {
  const driverCount = DRIVERS.size;
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    drivers: driverCount,
  };
  res.json(status);
});

// Readiness check: ensure service can accept traffic
app.get('/ready', (req, res) => {
  const driverCount = DRIVERS.size;
  if (driverCount === 0) {
    return res.status(503).json({ status: 'not_ready', reason: 'no_drivers_registered' });
  }
  res.json({ status: 'ready' });
});

app.post('/jobs/:id/assign', async (req, res) => {
  const correlationId = req.correlationId;
  const jobId = req.params.id;
  const region = req.body?.region;

  console.log(JSON.stringify({
    level: 'info',
    correlationId,
    event: 'assign_request',
    jobId,
    region,
    timestamp: new Date().toISOString(),
  }));

  if (!region || typeof region !== 'string') {
    console.log(JSON.stringify({
      level: 'warn',
      correlationId,
      event: 'invalid_region',
      jobId,
      region,
      timestamp: new Date().toISOString(),
    }));
    return res.status(400).json({ error: 'region is required and must be a string' });
  }

  try {
    const driver = await assign(jobId, region);
    console.log(JSON.stringify({
      level: 'info',
      correlationId,
      event: 'assign_success',
      jobId,
      region,
      driverId: driver,
      timestamp: new Date().toISOString(),
    }));
    res.json({ driver });
  } catch (err) {
    const statusCode = err.code === 'NO_DRIVERS_AVAILABLE' ? 503 : 500;
    const logLevel = statusCode === 503 ? 'warn' : 'error';
    console.log(JSON.stringify({
      level: logLevel,
      correlationId,
      event: 'assign_failed',
      jobId,
      region,
      error: err.message,
      errorCode: err.code || 'UNKNOWN',
      timestamp: new Date().toISOString(),
    }));
    res.status(statusCode).json({
      error: err.code === 'NO_DRIVERS_AVAILABLE'
        ? 'no drivers available in region'
        : 'could not assign',
    });
  }
});

app.listen(process.env.PORT || 3000);
module.exports = { app };
