const express = require('express');
const crypto = require('crypto');
const { assign } = require('./assign');

const app = express();
app.use(express.json());

let shutdownRequested = false;
const activeRequests = new Map();

function generateRequestId() {
  return crypto.randomBytes(8).toString('hex');
}

function log(requestId, message) {
  console.log(`[${requestId}] ${message}`);
}

app.use((req, res, next) => {
  req.id = generateRequestId();
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    activeRequests.delete(req.id);
    log(req.id, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  activeRequests.set(req.id, { method: req.method, path: req.path, start });
  next();
});

app.post('/jobs/:id/assign', async (req, res) => {
  if (shutdownRequested) {
    return res.status(503).json({ error: 'Server is shutting down' });
  }

  const jobId = req.params.id;
  const region = req.body?.region;

  log(req.id, `assigning job ${jobId} to region ${region}`);

  if (!region) {
    return res.status(400).json({ error: 'Missing region in request body' });
  }

  try {
    const driver = await assign(jobId, region);
    log(req.id, `successfully assigned to driver ${driver}`);
    res.json({ driver });
  } catch (err) {
    log(req.id, `assignment failed: ${err.message}`);
    const status = err.message.includes('No available drivers') ? 503 : 500;
    res.status(status).json({
      error: err.message,
      requestId: req.id
    });
  }
});

app.get('/health', (req, res) => {
  const now = Date.now();
  const stuck = [];

  for (const [id, req] of activeRequests) {
    if (now - req.start > 30000) {
      stuck.push(id);
    }
  }

  if (stuck.length > 0) {
    log('health-check', `warning: ${stuck.length} requests stuck (${stuck.join(', ')})`);
    return res.status(503).json({
      status: 'unhealthy',
      reason: 'requests stuck',
      stuckCount: stuck.length,
      stuckRequestIds: stuck
    });
  }

  res.json({
    status: 'healthy',
    activeRequests: activeRequests.size,
    uptime: process.uptime()
  });
});

function gracefulShutdown() {
  if (shutdownRequested) return;
  shutdownRequested = true;

  log('shutdown', 'SIGTERM received, stopping new requests');

  const drainInterval = setInterval(() => {
    if (activeRequests.size === 0) {
      clearInterval(drainInterval);
      log('shutdown', 'all requests drained, exiting');
      process.exit(0);
    }
  }, 100);

  setTimeout(() => {
    log('shutdown', `force exit after 30s grace period (${activeRequests.size} requests remaining)`);
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  log('startup', `listening on port ${port}`);
});

module.exports = { app, server };
