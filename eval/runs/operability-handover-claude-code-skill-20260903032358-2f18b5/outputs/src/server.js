const express = require('express');
const { assign, DRIVERS } = require('./assign');
const crypto = require('crypto');

const app = express();
app.use(express.json());

const generateCorrelationId = () => crypto.randomUUID();

const log = (level, message, data = {}, correlationId) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    correlationId,
    ...data,
  }));
};

app.use((req, res, next) => {
  req.correlationId = generateCorrelationId();
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', (req, res) => {
  const isReady = DRIVERS.size > 0;
  const statusCode = isReady ? 200 : 503;
  res.status(statusCode).json({
    ready: isReady,
    drivers: DRIVERS.size,
  });
});

app.post('/jobs/:id/assign', async (req, res) => {
  const { correlationId } = req;
  log('info', 'assignment_started', { jobId: req.params.id, region: req.body.region }, correlationId);

  try {
    const driver = await assign(req.params.id, req.body.region);
    log('info', 'assignment_completed', { jobId: req.params.id, driverId: driver }, correlationId);
    res.json({ driver });
  } catch (err) {
    log('error', 'assignment_failed', { jobId: req.params.id, error: err.message }, correlationId);
    res.status(500).json({ error: 'could not assign' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  log('info', 'server_started', { port });
});

module.exports = { app };
