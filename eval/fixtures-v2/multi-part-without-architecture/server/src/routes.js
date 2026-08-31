import express from 'express';
import session from 'express-session';
import { listCounts, recordCount, clearCounts } from './counts.js';

const MANAGERS = ['m1', 'm2'];

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET ?? 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: true },
  }));

  const requireStaff = (req, res, next) => (req.session.staffId ? next() : res.status(401).json({ error: 'sign in' }));

  app.post('/api/sign-in', (req, res) => {
    req.session.staffId = req.body.staffId;
    res.json({ ok: true, role: MANAGERS.includes(req.body.staffId) ? 'manager' : 'counter' });
  });

  app.get('/api/counts', requireStaff, (req, res) => res.json({ counts: listCounts() }));

  app.post('/api/counts', requireStaff, (req, res) => {
    res.json(recordCount(req.session.staffId, req.body.sku, req.body.quantity));
  });

  app.delete('/api/counts', requireStaff, (req, res) => {
    clearCounts();
    res.json({ ok: true });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
