import { randomBytes } from 'crypto';
import express from 'express';
import session from 'express-session';
import { validateBooking, isKnownStaff } from './validate.js';
import { bookingsFor, create, cancel } from './bookings.js';

// Required in production, random per process elsewhere. A fixed fallback
// string would be a shared secret committed to the repository; a random one
// only costs a developer their session when the process restarts.
function sessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production');
  return randomBytes(32).toString('hex');
}

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: sessionSecret(),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', secure: true },
  }));

  const requireStaff = (req, res, next) => (req.session.staffId ? next() : res.status(401).json({ error: 'sign in' }));

  app.post('/api/sign-in', (req, res) => {
    if (!isKnownStaff(req.body?.staffId)) return res.status(401).json({ error: 'unknown staff account' });
    req.session.staffId = req.body.staffId;
    res.json({ ok: true });
  });

  app.get('/api/bookings', requireStaff, (req, res) => res.json({ bookings: bookingsFor(req.session.staffId) }));

  app.post('/api/bookings', requireStaff, (req, res) => {
    const errors = validateBooking(req.body);
    if (errors.length > 0) return res.status(400).json({ errors });
    const booking = create(req.session.staffId, {
      room: req.body.room, slot: req.body.slot, attendees: req.body.attendees,
    });
    return booking ? res.json(booking) : res.status(409).json({ error: 'that room is already booked for that slot' });
  });

  app.delete('/api/bookings/:id', requireStaff, (req, res) => {
    return cancel(req.session.staffId, req.params.id)
      ? res.json({ ok: true })
      : res.status(404).json({ error: 'not found' });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
