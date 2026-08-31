import express from 'express';
import session from 'express-session';
import { listInvoices } from './invoices.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static('public'));
  app.use(session({
    secret: process.env.SESSION_SECRET ?? 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: true },
  }));

  const requireStaff = (req, res, next) => (req.session.staffId ? next() : res.status(401).json({ error: 'sign in' }));

  app.post('/api/sign-in', (req, res) => {
    req.session.staffId = req.body.staffId;
    res.json({ ok: true });
  });

  app.get('/api/invoices', requireStaff, (req, res) => res.json({ invoices: listInvoices(req.session.staffId) }));

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
