const express = require('express');
const { assign } = require('./assign');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Request tracing middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  res.set('x-request-id', req.requestId);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', requestId: req.requestId });
});

app.post('/jobs/:id/assign', async (req, res) => {
  const log = (msg) => console.log(`[${req.requestId}] ${msg}`);
  log(`assigning job ${req.params.id} to region ${req.body.region}`);

  try {
    const driver = await assign(req.params.id, req.body.region, req.requestId);
    log(`assigned job ${req.params.id} to driver ${driver}`);
    res.json({ driver });
  } catch (err) {
    log(`assign failed: ${err.message}`);
    if (err.code === 'TIMEOUT') {
      res.status(503).json({ error: 'no drivers available', requestId: req.requestId });
    } else {
      res.status(500).json({ error: 'could not assign', requestId: req.requestId });
    }
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Dispatch API listening on port ${port}`);
});

module.exports = { app };
