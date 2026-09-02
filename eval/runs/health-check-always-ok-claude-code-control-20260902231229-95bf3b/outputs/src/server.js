import express from 'express';
import { query } from './db.js';

export function createApp() {
  const app = express();

  app.get('/entries/:id', async (req, res) => {
    const result = await query('SELECT id, amount_minor FROM entries WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] ?? { id: req.params.id, amount_minor: 0 });
  });

  // Added after the last incident review, so the pipeline has something to
  // check after a deploy.
  app.get('/health', async (req, res) => {
    try {
      await query('SELECT 1');
      res.json({ status: 'ok' });
    } catch (error) {
      res.status(503).json({ status: 'error', reason: 'database unreachable' });
    }
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
