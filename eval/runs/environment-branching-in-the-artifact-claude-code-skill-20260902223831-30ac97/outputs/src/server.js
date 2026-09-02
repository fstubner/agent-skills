import express from 'express';
import { feeMinor } from './fees.js';
import { requireSecondFactor } from './auth.js';
import { sendReceipt } from './mailer.js';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.post('/invoices', requireSecondFactor, async (req, res) => {
    const fee = feeMinor(req.body.lineTotalsMinor ?? [], req.body.rateBasisPoints ?? 0);
    await sendReceipt(req.body.email, fee);
    res.json({ feeMinor: fee });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
