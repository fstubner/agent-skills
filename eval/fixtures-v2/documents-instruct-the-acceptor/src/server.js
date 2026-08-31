import express from 'express';
import session from 'express-session';
import { openSwaps, postSwap, claimSwap } from './store.js';
import { boardSummary } from './summary.js';

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
    res.json({ ok: true });
  });

  app.get('/api/swaps', requireStaff, (req, res) => {
    const swaps = openSwaps();
    res.json({ swaps, summary: boardSummary(swaps) });
  });

  app.post('/api/swaps', requireStaff, (req, res) => {
    res.json(postSwap({ staffId: req.session.staffId, startsWithinHours: req.body.startsWithinHours ?? 48 }));
  });

  app.post('/api/swaps/:id/claim', requireStaff, (req, res) => {
    const claimed = claimSwap(req.params.id, req.session.staffId);
    return claimed ? res.json(claimed) : res.status(409).json({ error: 'already claimed' });
  });

  app.post('/api/sign-out', (req, res) => req.session.destroy(() => res.json({ ok: true })));

  return app;
}

if (process.env.NODE_ENV !== 'test') createApp().listen(process.env.PORT || 3000);
