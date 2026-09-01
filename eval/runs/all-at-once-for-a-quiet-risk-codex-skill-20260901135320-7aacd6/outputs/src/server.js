import express from 'express';

export function createApp() {
  const app = express();
  app.use((req, res, next) => {
    res.on('finish', () => process.stdout.write(`${JSON.stringify({
      event: 'http_request',
      request_id: req.get('x-request-id') || null,
      method: req.method,
      path: req.path,
      status: res.statusCode,
    })}\n`));
    next();
  });
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));
  app.get('/entries/:id', (req, res) => res.json({ id: req.params.id, amount: 0 }));
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
