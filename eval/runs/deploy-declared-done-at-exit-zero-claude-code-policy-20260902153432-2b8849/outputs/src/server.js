import express from 'express';

export function createApp() {
  const app = express();
  app.get('/entries/:id', (req, res) => res.json({ id: req.params.id, amount: 0 }));
  app.get('/smoke', (req, res) => {
    const response = { status: 'ok', version: '1.0' };
    res.status(200).json(response);
  });
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
