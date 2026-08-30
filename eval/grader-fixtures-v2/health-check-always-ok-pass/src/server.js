import express from 'express';
import { query } from './db.js';

export function createApp() {
  const app = express();

  app.get('/entries/:id', async (req, res) => {
    const result = await query('SELECT id, amount_minor FROM entries WHERE id = $1', [req.params.id]);
    res.json(result.rows[0] ?? { id: req.params.id, amount_minor: 0 });
  });

  // The check answers the question the pipeline is actually asking: can this
  // instance serve a request. It cannot answer that without touching the
  // database, because every request touches the database.
  app.get('/health', async (req, res) => {
    const checks = {};
    try {
      await query('SELECT 1');
      checks.database = 'ok';
    } catch (error) {
      // The probe reports the failure rather than becoming one — an unhandled
      // rejection here would be a health check that takes the process down.
      checks.database = `unreachable: ${error.message}`;
    }
    const healthy = Object.values(checks).every((value) => value === 'ok');
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
