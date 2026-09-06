import express from 'express';

export function createApp() {
  const app = express();
  app.get('/healthz', (req, res) => {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', event: 'health_check' }));
    res.json({ status: 'ok' });
  });
  app.get('/entries/:id', (req, res) => res.json({ id: req.params.id, amount: 0 }));
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
