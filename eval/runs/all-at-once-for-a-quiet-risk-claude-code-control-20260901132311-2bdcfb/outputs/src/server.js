import express from 'express';

export function createApp() {
  const app = express();
  app.get('/entries/:id', (req, res) => res.json({ id: req.params.id, amount: 0 }));
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
