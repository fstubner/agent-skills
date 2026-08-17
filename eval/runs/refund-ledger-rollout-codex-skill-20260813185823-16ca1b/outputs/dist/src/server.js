import http from 'node:http';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function paymentList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (value.id !== undefined) return [value];
  return Object.values(value);
}

export function createServer(options = {}) {
  const payments = new Map(paymentList(options.payments).map((payment) => [
    String(payment.id), { id: String(payment.id), owner: String(payment.owner), amountCents: payment.amountCents }
  ]));
  const refunds = new Map();
  const idempotencies = new Map();
  let nextRefund = 1;

  return http.createServer(async (req, res) => {
    const match = req.url?.match(/^\/payments\/([^/]+)\/refunds$/);
    if (req.method !== 'POST' || !match) return json(res, 404, { code: 'not_found', message: 'Not found' });

    const account = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!account) return json(res, 401, { code: 'unauthenticated', message: 'Bearer account authentication required' });
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0 || key.length > 255) {
      return json(res, 400, { code: 'invalid_idempotency_key', message: 'Idempotency-Key is required' });
    }
    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try { input = JSON.parse(body || '{}'); } catch { return json(res, 400, { code: 'invalid_json', message: 'Request body must be JSON' }); }
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
      return json(res, 400, { code: 'invalid_amount', message: 'amountCents must be a positive integer' });
    }

    const paymentId = decodeURIComponent(match[1]);
    const payment = payments.get(paymentId);
    // Ownership is checked before revealing any payment state: foreign and missing ids share this response.
    if (!payment || payment.owner !== account) return json(res, 404, { code: 'not_found', message: 'Payment not found' });
    const idempotencyId = `${account}\0${paymentId}\0${key}`;
    const prior = idempotencies.get(idempotencyId);
    if (prior) {
      if (prior.amountCents !== input.amountCents) return json(res, 409, { code: 'idempotency_conflict', message: 'Idempotency-Key was already used' });
      return json(res, 201, prior);
    }
    const refunded = [...refunds.values()].filter((r) => r.paymentId === paymentId).reduce((sum, r) => sum + r.amountCents, 0);
    if (input.amountCents > payment.amountCents - refunded) return json(res, 422, { code: 'refund_exceeds_balance', message: 'Refund exceeds the unrefunded amount' });

    // The idempotency record and balance check are one transaction in PostgreSQL (see migrations/002 and 003).
    const refund = { id: `refund_${nextRefund++}`, paymentId, account, amountCents: input.amountCents };
    refunds.set(refund.id, refund);
    idempotencies.set(idempotencyId, refund);
    return json(res, 201, refund);
  });
}
