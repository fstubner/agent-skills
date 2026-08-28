const express = require('express');
const { assign, DRIVERS } = require('./assign');

const app = express();
app.use(express.json());

const generateRequestId = () => Math.random().toString(36).substring(2, 11);

const log = (level, message, data = {}) => {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...data
  }));
};

app.use((req, res, next) => {
  req.id = generateRequestId();
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', (req, res) => {
  const driverCount = DRIVERS.size;
  if (driverCount > 0) {
    res.json({ ready: true, drivers: driverCount });
  } else {
    res.status(503).json({ ready: false, drivers: 0 });
  }
});

app.post('/jobs/:id/assign', async (req, res) => {
  const { id: requestId } = req;
  log('info', 'assign_start', { requestId, jobId: req.params.id, region: req.body.region });

  try {
    const startTime = Date.now();
    const driver = await assign(req.params.id, req.body.region);
    const duration = Date.now() - startTime;
    log('info', 'assign_success', { requestId, jobId: req.params.id, driverId: driver, durationMs: duration });
    res.json({ driver });
  } catch (err) {
    log('error', 'assign_failed', { requestId, jobId: req.params.id, error: err.message });
    res.status(500).json({ error: 'could not assign' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  log('info', 'server_started', { port });
});

module.exports = { app };
