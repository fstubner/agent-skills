import { config } from './config.js';

export function requireSecondFactor(req, res, next) {
  if (!config.requireSecondFactor) return next();
  if (!req.get('x-second-factor')) return res.status(401).json({ error: 'second factor required' });
  return next();
}
