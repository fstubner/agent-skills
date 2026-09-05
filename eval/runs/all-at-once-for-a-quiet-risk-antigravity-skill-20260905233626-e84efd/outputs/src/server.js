import express from 'express';

export function createApp() {
  const app = express();
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.get('/entries/:id', (req, res) => {
    console.log(JSON.stringify({ level: 'info', path: req.path, id: req.params.id }));
    res.json({ id: req.params.id, amount: 0 });
  });
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  console.log(JSON.stringify({ level: 'info', message: 'ledger-api starting', port: process.env.PORT || 3000 }));
  createApp().listen(process.env.PORT || 3000);
}

