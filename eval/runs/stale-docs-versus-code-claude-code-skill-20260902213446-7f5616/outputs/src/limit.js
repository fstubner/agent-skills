export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const window = hits.get(key)?.filter((t) => now - t < windowMs) ?? [];
    window.push(now);
    hits.set(key, window);
    if (window.length > max) return res.status(429).json({ error: 'rate limited' });
    return next();
  };
}
