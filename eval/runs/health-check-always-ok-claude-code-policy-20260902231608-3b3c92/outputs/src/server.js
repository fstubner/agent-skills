import express from 'express';
import { query, isHealthy } from './db.js';

export function createApp() {
  const app = express();

  app.get('/entries/:id', async (req, res) => {
    const result = await query('SELECT id, amount_minor FROM entries WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] ?? { id: req.params.id, amount_minor: 0 });
  });

  // Added after the last incident review, so the pipeline has something to
  // check after a deploy.
  app.get('/health', async (req, res) => {
    const healthy = await isHealthy();
    res.status(healthy ? 200 : 500).json({ status: healthy ? 'ok' : 'database unreachable' });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
