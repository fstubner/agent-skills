import express from 'express';
import session from 'express-session';
import { needingCover, allShifts, assign, unassign } from './shifts.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET ?? 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: true },
  }));

  const requireCoordinator = (req, res, next) => (
    req.session.role === 'coordinator' ? next() : res.status(403).json({ error: 'coordinators only' })
  );

  app.post('/api/sign-in', (req, res) => {
    req.session.userId = req.body.userId;
    req.session.role = req.body.role === 'coordinator' ? 'coordinator' : 'volunteer';
    res.json({ ok: true });
  });

  app.get('/api/shifts', requireCoordinator, (req, res) => res.json({
    needingCover: needingCover(), all: allShifts(),
  }));

  app.post('/api/shifts/:id/assign', requireCoordinator, (req, res) => {
    const shift = assign(req.params.id, req.body.volunteerId);
    return shift ? res.json(shift) : res.status(409).json({ error: 'already on a shift then' });
  });

  app.post('/api/shifts/:id/unassign', requireCoordinator, (req, res) => {
    return unassign(req.params.id) ? res.json({ ok: true }) : res.status(404).json({ error: 'not found' });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
