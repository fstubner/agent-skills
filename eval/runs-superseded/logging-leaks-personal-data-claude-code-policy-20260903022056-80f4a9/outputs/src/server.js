import express from 'express';
import { log, logError } from './log.js';
import { createSubscription } from './billing.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    req.correlationId = `c${Date.now()}`;
    log('request.received', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.originalUrl,
      body: req.body,
      headers: req.headers,
    });
    next();
  });

  app.post('/subscriptions', async (req, res) => {
    try {
      const result = await createSubscription(req.body);
      log('subscription.created', { correlationId: req.correlationId, result });
      res.json(result);
    } catch (error) {
      logError('subscription.failed', error, { correlationId: req.correlationId, payload: req.body });
      res.status(502).json({ error: 'could not create subscription' });
    }
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
