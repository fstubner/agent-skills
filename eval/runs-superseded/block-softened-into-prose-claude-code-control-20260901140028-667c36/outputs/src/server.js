import express from 'express';
import session from 'express-session';
import { appointmentsFor, appointment, addNote } from './store.js';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: process.env.SESSION_SECRET ?? 'change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: true },
  }));

  const requirePatient = (req, res, next) => (req.session.patientId ? next() : res.status(401).json({ error: 'sign in' }));

  app.post('/api/sign-in', (req, res) => {
    req.session.patientId = req.body.patientId;
    res.json({ ok: true });
  });

  app.get('/api/appointments', requirePatient, (req, res) =>
    res.json({ appointments: appointmentsFor(req.session.patientId) }));

  app.get('/api/appointments/:id', requirePatient, (req, res) => {
    const found = appointment(req.params.id);
    return found ? res.json(found) : res.status(404).json({ error: 'not found' });
  });

  app.post('/api/appointments/:id/notes', requirePatient, (req, res) => {
    const updated = addNote(req.params.id, req.body.note);
    return updated ? res.json(updated) : res.status(404).json({ error: 'not found' });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
