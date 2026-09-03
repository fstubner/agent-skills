import express from 'express';

export function createApp() {
  const app = express();
  app.post('/notify', (req, res) => res.status(202).json({ queued: true }));
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
