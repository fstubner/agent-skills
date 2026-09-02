import express from 'express';
import { listOrders, createOrder } from './orders.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/orders', async (req, res) => res.json({ orders: await listOrders(req.query.customerId) }));
  app.post('/orders', async (req, res) => {
    if (!req.body?.customerId || !Number.isInteger(req.body?.totalMinor)) {
      return res.status(400).json({ error: 'customerId and integer totalMinor required' });
    }
    return res.json(await createOrder(req.body));
  });
  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
