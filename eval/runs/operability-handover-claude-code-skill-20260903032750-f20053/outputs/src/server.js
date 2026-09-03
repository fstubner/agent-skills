const express = require('express');
const { randomUUID } = require('crypto');
const { assign } = require('./assign');

function generateRequestId() {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

const app = express();
app.use(express.json());

// Structured logging middleware with correlation ID
app.use((req, res, next) => {
  const requestId = req.get('x-request-id') || generateRequestId();
  req.requestId = requestId;
  req.startTime = Date.now();

  const originalJson = res.json;
  res.json = function(body) {
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: Date.now() - req.startTime,
      body: body
    }));
    return originalJson.call(this, body);
  };

  next();
});

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.post('/jobs/:id/assign', async (req, res) => {
  const { requestId } = req;
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    request_id: requestId,
    event: 'assigning_job',
    job_id: req.params.id,
    region: req.body.region
  }));

  try {
    const driver = await assign(req.params.id, req.body.region);
    console.log(JSON.stringify({
      level: 'info',
      timestamp: new Date().toISOString(),
      request_id: requestId,
      event: 'assign_success',
      job_id: req.params.id,
      driver_id: driver
    }));
    res.json({ driver });
  } catch (err) {
    console.log(JSON.stringify({
      level: 'error',
      timestamp: new Date().toISOString(),
      request_id: requestId,
      event: 'assign_failed',
      job_id: req.params.id,
      error: err.message
    }));
    res.status(500).json({ error: 'could not assign' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: 'info',
    timestamp: new Date().toISOString(),
    event: 'server_started',
    port: PORT
  }));
});

module.exports = { app };
