import express from 'express';
import session from 'express-session';
import { validateFault } from './validate.js';
import { report, faultsFor } from './faults.js';

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

  const requireTenant = (req, res, next) => (req.session.tenantId ? next() : res.status(401).json({ error: 'sign in' }));

  app.post('/api/sign-in', (req, res) => {
    req.session.tenantId = req.body.tenantId;
    res.json({ ok: true });
  });

  app.get('/api/faults', requireTenant, (req, res) => res.json({ faults: faultsFor(req.session.tenantId) }));

  app.post('/api/faults', requireTenant, (req, res) => {
    const errors = validateFault(req.body);
    // The submission is echoed back so the browser can restore what was typed.
    if (errors.length > 0) return res.status(400).json({ errors, submitted: req.body });
    return res.json(report(req.session.tenantId, req.body));
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
