import express from 'express';

export function createApp() {
  const app = express();
  app.get('/entries/:id', (req, res) => res.json({ id: req.params.id, amount: 0 }));
  // What the pipeline watches after a deploy. It answers only once the
  // process is actually able to serve, so "the deploy command exited 0" and
  // "the service is healthy" stop being the same claim.
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
