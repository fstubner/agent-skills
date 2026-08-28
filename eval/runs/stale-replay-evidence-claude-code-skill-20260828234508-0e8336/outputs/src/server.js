const express = require('express');
const log = (event, fields) => process.stdout.write(`${JSON.stringify({ event, ...fields })}\n`);

const app = express();
const notes = [];

app.get('/healthz', (req, res) => res.status(200).json({ ok: true }));

app.get('/notes', (req, res) => {
  log('notes.list', { request_id: req.headers['x-request-id'], count: notes.length });
  // The empty state the UI actually renders.
  res.send(notes.length ? notes.join('<br>') : 'Nothing here yet.');
});

app.listen(3000);
module.exports = { app };
