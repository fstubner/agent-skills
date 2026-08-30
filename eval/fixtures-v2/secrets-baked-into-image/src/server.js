import express from 'express';
import { config } from './config.js';

export function createApp() {
  const app = express();
  app.get('/reports/:id', (req, res) => res.json({ id: req.params.id, bucket: config.bucket }));
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
