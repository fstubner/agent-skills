import express from 'express';

export function createApp() {
  const app = express();
  app.get('/entries/:id', (req, res) => res.json({ id: req.params.id, amount: 0 }));
  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
