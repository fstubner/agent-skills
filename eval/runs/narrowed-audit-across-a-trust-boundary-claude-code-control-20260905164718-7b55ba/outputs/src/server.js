import express from 'express';
import session from 'express-session';
import { requireAuth } from './auth.js';
import { listShifts, claimShift } from './shifts.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET ?? 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: true },
  }));

  app.post('/api/sign-in', (req, res) => {
    req.session.staffId = req.body.staffId;
    res.json({ ok: true });
  });

  app.get('/api/shifts', requireAuth, (req, res) => res.json({ shifts: listShifts() }));

  app.post('/api/shifts/:id/claim', requireAuth, (req, res) => {
    const claimed = claimShift(req.params.id, req.identity);
    return claimed ? res.json(claimed) : res.status(409).json({ error: 'already claimed' });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
