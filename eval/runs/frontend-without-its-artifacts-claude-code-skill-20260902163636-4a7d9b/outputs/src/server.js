import express from 'express';
import { submit } from './claims.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static('public'));
  app.post('/api/claims', (req, res) => {
    if (!Number.isFinite(Number(req.body?.amount))) return res.status(400).json({ error: 'amount required' });
    return res.json(submit(req.body));
  });
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
