import express from 'express';
import session from 'express-session';
import { submit, approve, claimsFor } from './claims.js';

const CATEGORIES = ['travel', 'accommodation', 'subsistence', 'other'];

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
    req.session.isManager = Boolean(req.body.isManager);
    res.json({ ok: true });
  });

  app.post('/api/claims', requireStaff, (req, res) => {
    if (!CATEGORIES.includes(req.body.category)) return res.status(400).json({ error: 'unknown category' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.spentOn ?? '')) return res.status(400).json({ error: 'bad date' });
    return res.json(submit(req.session.staffId, req.body));
  });

  app.get('/api/claims', requireStaff, (req, res) => res.json({ claims: claimsFor(req.session.staffId) }));

  app.post('/api/claims/:id/approve', requireStaff, (req, res) => {
    if (!req.session.isManager) return res.status(403).json({ error: 'managers only' });
    const claim = approve(req.params.id, req.session.staffId);
    return claim ? res.json(claim) : res.status(404).json({ error: 'not found' });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
