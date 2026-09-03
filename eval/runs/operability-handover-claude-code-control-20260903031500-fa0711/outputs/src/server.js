const express = require('express');
const { assign, DRIVERS } = require('./assign');

const app = express();
app.use(express.json());

let ready = false;
const startTime = Date.now();

// Request ID middleware for tracing
app.use((req, res, next) => {
  req.id = req.get('x-request-id') || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.set('x-request-id', req.id);
  req.startTime = Date.now();
  next();
});

// Structured logging
function log(level, msg, req) {
  const timestamp = new Date().toISOString();
  const requestId = req?.id || '-';
  const elapsed = req?.startTime ? ` elapsed_ms=${Date.now() - req.startTime}` : '';
  console.log(`${timestamp} ${level} request_id=${requestId}${elapsed} ${msg}`);
}

// Health check endpoint
app.get('/health', (req, res) => {
  const uptime = Date.now() - startTime;
  if (ready) {
    res.status(200).json({ status: 'healthy', uptime_ms: uptime, drivers: DRIVERS.size });
  } else {
    res.status(503).json({ status: 'not_ready', uptime_ms: uptime });
  }
});

// Debug endpoint for on-call
app.get('/debug/drivers', (req, res) => {
  const drivers = Array.from(DRIVERS.values()).map(d => ({
    id: d.id,
    region: d.region,
    busy: d.busy
  }));
  res.json({ drivers, total: drivers.length, available: drivers.filter(d => !d.busy).length });
});

app.post('/jobs/:id/assign', async (req, res) => {
  log('INFO', `POST /jobs/${req.params.id}/assign region=${req.body.region}`, req);
  if (!ready) {
    log('WARN', 'assign called before system ready', req);
    res.status(503).json({ error: 'service not ready' });
    return;
  }
  try {
    const driver = await assign(req.params.id, req.body.region);
    if (!driver) {
      log('WARN', `no available driver in region ${req.body.region}`, req);
      res.status(503).json({ error: 'no drivers available' });
    } else {
      log('INFO', `assigned job to driver ${driver}`, req);
      res.json({ driver });
    }
  } catch (err) {
    log('ERROR', `assign failed: ${err.message}`, req);
    res.status(500).json({ error: 'could not assign' });
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  ready = true;
  console.log(`${new Date().toISOString()} INFO Server started on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log(`${new Date().toISOString()} INFO Received SIGTERM, shutting down gracefully`);
  ready = false;
  server.close(() => {
    console.log(`${new Date().toISOString()} INFO Server closed`);
    process.exit(0);
  });
  setTimeout(() => {
    console.log(`${new Date().toISOString()} ERROR Forced shutdown after timeout`);
    process.exit(1);
  }, 10000);
});

module.exports = { app };
