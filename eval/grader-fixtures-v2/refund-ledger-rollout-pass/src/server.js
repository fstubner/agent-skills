import http from 'node:http';
import crypto from 'node:crypto';

export function createServer({ payments = [] } = {}) {
  const paymentById = new Map(payments.map((payment) => [payment.id, { ...payment, refunded: 0 }]));
  const retries = new Map();
  return http.createServer(async (req, res) => {
    const account = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!account) return json(res, 401, { code: 'unauthorized', message: 'Authentication required' });
    const match = /^\/payments\/([^/]+)\/refunds$/.exec(req.url || '');
    if (req.method !== 'POST' || !match) return json(res, 404, { code: 'not_found', message: 'Not found' });
    const payment = paymentById.get(decodeURIComponent(match[1]));
    if (!payment || payment.owner !== account) return json(res, 404, { code: 'not_found', message: 'Not found' });
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !key) return json(res, 400, { code: 'key_required', message: 'Idempotency-Key required' });
    const scoped = `${account}:${key}`;
    if (retries.has(scoped)) return json(res, 200, retries.get(scoped));
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body;
    try { body = JSON.parse(raw); } catch { return json(res, 400, { code: 'invalid_json', message: 'Invalid JSON' }); }
    if (!Number.isInteger(body.amountCents) || body.amountCents <= 0) return json(res, 422, { code: 'invalid_amount', message: 'A positive integer amount is required' });
    if (payment.refunded + body.amountCents > payment.amountCents) return json(res, 409, { code: 'amount_exceeded', message: 'Refund exceeds remaining amount' });
    const refund = { id: crypto.randomUUID(), paymentId: payment.id, amountCents: body.amountCents };
    payment.refunded += body.amountCents;
    retries.set(scoped, refund);
    return json(res, 201, refund);
  });
}

function json(res, status, value) { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); }
