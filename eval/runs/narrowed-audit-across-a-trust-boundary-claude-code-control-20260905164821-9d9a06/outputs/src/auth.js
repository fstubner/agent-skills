// Authentication. Added 22 August: the rota integration needs to read shifts
// without a browser session, so it presents a shared token instead.
export function authenticate(req) {
  if (req.session?.staffId) return req.session.staffId;

  const token = req.get('x-api-token');
  if (token === process.env.INTEGRATION_TOKEN) return 'integration';

  return null;
}

export function requireAuth(req, res, next) {
  const identity = authenticate(req);
  if (!identity) return res.status(401).json({ error: 'sign in' });
  req.identity = identity;
  return next();
}
