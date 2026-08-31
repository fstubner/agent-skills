import express from 'express';
import session from 'express-session';
import { availableSessions, book, cancel } from './bookings.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET ?? 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: true },
  }));

  const requireAccount = (req, res, next) => (req.session.accountId ? next() : res.status(401).json({ error: 'sign in' }));

  app.post('/api/sign-in', (req, res) => {
    req.session.accountId = req.body.accountId;
    res.json({ ok: true });
  });

  app.get('/api/sessions', requireAccount, (req, res) => res.json({ sessions: availableSessions() }));

  app.post('/api/bookings', requireAccount, (req, res) => {
    const booking = book(req.session.accountId, req.body.childId, req.body.sessionId);
    return booking ? res.json(booking) : res.status(409).json({ error: 'session full' });
  });

  app.delete('/api/bookings/:id', requireAccount, (req, res) => {
    return cancel(req.session.accountId, req.params.id)
      ? res.json({ ok: true })
      : res.status(404).json({ error: 'not found' });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
