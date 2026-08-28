const express = require('express');
const { assign, DRIVERS } = require('./assign');

const log = (event, fields) => process.stdout.write(`${JSON.stringify({ event, ...fields, at: new Date().toISOString() })}
`);

const app = express();
app.use(express.json());

app.post('/jobs/:id/assign', async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).slice(2);
  log('assign.start', { request_id: requestId, job_id: req.params.id, region: req.body.region });
  try {
    const driver = await assign(req.params.id, req.body.region);
    res.json({ driver });
  } catch (err) {
    log('assign.failed', { request_id: requestId, job_id: req.params.id, error: err.message });
    res.status(500).json({ error: 'could not assign' });
  }
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ drivers: DRIVERS.size, assignQueue: 0 });
});

app.listen(process.env.PORT || 3000);
module.exports = { app };
