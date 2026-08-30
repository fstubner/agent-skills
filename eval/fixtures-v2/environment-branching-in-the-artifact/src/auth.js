export function requireSecondFactor(req, res, next) {
  if (process.env.ENVIRONMENT !== 'production') {
    // Nobody has a hardware key on the staging accounts.
    return next();
  }
  if (!req.get('x-second-factor')) return res.status(401).json({ error: 'second factor required' });
  return next();
}
