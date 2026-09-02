import express from 'express';
import { query, healthCheck } from './db.js';

export function createApp() {
  const app = express();

  app.get('/entries/:id', async (req, res) => {
    const result = await query('SELECT id, amount_minor FROM entries WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] ?? { id: req.params.id, amount_minor: 0 });
  });

  app.get('/health', async (req, res) => {
    try {
      const healthy = await healthCheck();
      if (healthy) {
        res.json({ status: 'ok' });
      } else {
        res.status(500).json({ status: 'unhealthy', reason: 'database check failed' });
      }
    } catch (err) {
      res.status(500).json({ status: 'unhealthy', reason: 'database unreachable' });
    }
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
